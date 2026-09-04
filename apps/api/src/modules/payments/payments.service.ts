import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentIntent, PaymentIntentStatus } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { paymentIntentPublicId } from '../../common/util/public-id';
import { ORANGE_PROVIDER, OrangeMoneyProvider } from '../orange/orange-provider.interface';
import { ModemManager } from '../orange/modem-manager.service';

interface CreateIntentInput {
  refType: string;
  refId: string;
  userId?: string;
  amountGnf: string;
  customerPhone?: string;
}

/**
 * Orange Money collection engine. Creates a PaymentIntent, allocates a modem,
 * initiates collection, polls status, and reconciles. A payment is only
 * PAYMENT_VERIFIED after correlation — never on a single SMS/USSD success.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly lock: RedisLockService,
    private readonly modems: ModemManager,
    @Inject(ORANGE_PROVIDER) private readonly orange: OrangeMoneyProvider,
  ) {}

  private entity(id: string) {
    return this.prisma.paymentIntent.findUniqueOrThrow({ where: { id } });
  }

  private async event(tx: Tx, intentId: string, type: string, source: string, payload?: unknown) {
    await tx.paymentEvent.create({ data: { intentId, type, source, payload: payload as never } });
  }

  async createIntent(tx: Tx, input: CreateIntentInput): Promise<PaymentIntent> {
    const intent = await tx.paymentIntent.create({
      data: {
        publicId: paymentIntentPublicId(),
        userId: input.userId,
        refType: input.refType,
        refId: input.refId,
        method: 'ORANGE_MONEY',
        amount: Money.of(input.amountGnf, 'GNF').toString(),
        currency: 'GNF',
        customerPhone: input.customerPhone,
        status: 'CREATED',
        expiresAt: new Date(Date.now() + this.config.flow.paymentWindowSeconds * 1000),
      },
    });
    await this.event(tx, intent.id, 'created', 'SYSTEM', { refType: input.refType, refId: input.refId });
    return intent;
  }

  /** CREATED -> AWAITING_PAYMENT: allocate a modem and initiate collection. */
  async startCollection(intentId: string): Promise<void> {
    await this.lock.withLock(`intent:${intentId}`, async () => {
      const intent = await this.entity(intentId);
      if (intent.status !== 'CREATED') return;

      const modemId = await this.prisma.runInTransaction((tx) =>
        this.modems.allocate(tx, intent.amount.toFixed(), 'COLLECT'),
      );

      let externalReference: string;
      try {
        const res = await this.orange.initiateCollect({
          intentId,
          modemId,
          amount: intent.amount.toFixed(),
          customerPhone: intent.customerPhone ?? undefined,
          reference: intent.publicId,
        });
        externalReference = res.externalReference;
        await this.prisma.orangeSession.create({
          data: {
            modemId,
            kind: 'USSD',
            command: `COLLECT ${intent.amount.toFixed()} ${intent.customerPhone ?? ''}`,
            response: `accepted ref=${externalReference}`,
            refType: 'payment_intent',
            refId: intentId,
            status: 'SUCCESS',
            endedAt: new Date(),
          },
        });
      } catch (err) {
        await this.modems.release(modemId, { success: false });
        throw err;
      }

      await this.prisma.runInTransaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intentId },
          data: {
            status: 'AWAITING_PAYMENT',
            assignedModemId: modemId,
            assignedGateway: this.orange.key,
            externalReference,
          },
        });
        await this.event(tx, intentId, 'collection_started', 'MODEM', { modemId, externalReference });
        await this.audit.record(tx, {
          action: 'payment.collection_started',
          entityType: 'PaymentIntent',
          entityId: intentId,
          after: { modemId, externalReference },
        });
      });
    });
  }

  /** Poll the rail; drive to PAYMENT_DETECTED then reconcile. Returns the resulting status. */
  async pollIntent(intentId: string): Promise<PaymentIntentStatus> {
    return this.lock.withLock(`intent:${intentId}`, async () => {
      const intent = await this.entity(intentId);
      if (!['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_RECONCILING'].includes(intent.status)) {
        return intent.status;
      }
      if (!intent.externalReference) return intent.status;

      const status = await this.orange.checkStatus(intent.externalReference);
      if (status.status === 'PENDING') return intent.status;

      if (status.status === 'FAILED') {
        await this.prisma.runInTransaction(async (tx) => {
          await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'PAYMENT_REJECTED' } });
          await this.event(tx, intentId, 'rejected', 'MODEM', status.raw);
        });
        if (intent.assignedModemId) await this.modems.release(intent.assignedModemId, { success: false });
        return 'PAYMENT_REJECTED';
      }

      // SETTLED — record detection, then reconcile.
      if (intent.status === 'AWAITING_PAYMENT') {
        await this.prisma.runInTransaction(async (tx) => {
          await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'PAYMENT_DETECTED' } });
          await this.event(tx, intentId, 'detected', 'SMS', status);
        });
      }
      return this.reconcileIntent(intentId, status.amount);
    });
  }

  /**
   * Correlation gate. Compares expected vs observed amount + reference + timing.
   * Only a clean match yields PAYMENT_VERIFIED; anything else goes UNDER_REVIEW.
   */
  async reconcileIntent(intentId: string, observedAmount?: string): Promise<PaymentIntentStatus> {
    const intent = await this.entity(intentId);
    if (intent.status === 'PAYMENT_VERIFIED') return intent.status;

    const expected = Money.of(intent.amount.toFixed(), 'GNF');
    const observed = observedAmount ? Money.of(observedAmount, 'GNF') : expected;
    const amountsMatch = expected.eq(observed);
    const withinWindow = !intent.expiresAt || intent.expiresAt.getTime() + 3_600_000 > Date.now();
    const matched = amountsMatch && withinWindow;

    await this.prisma.runInTransaction(async (tx) => {
      await tx.reconciliation.create({
        data: {
          intentId,
          kind: 'PAYMENT',
          status: matched ? 'MATCHED' : 'MISMATCH',
          expectedAmount: expected.toString(),
          observedAmount: observed.toString(),
          correlation: {
            reference: intent.externalReference,
            publicId: intent.publicId,
            customerPhone: intent.customerPhone,
            amountsMatch,
            withinWindow,
            detectedAt: new Date().toISOString(),
          },
          mismatchReason: matched ? null : !amountsMatch ? 'AMOUNT_MISMATCH' : 'OUT_OF_WINDOW',
        },
      });
      await tx.paymentIntent.update({
        where: { id: intentId },
        data: { status: matched ? 'PAYMENT_VERIFIED' : 'UNDER_REVIEW', verifiedAt: matched ? new Date() : null },
      });
      await this.event(tx, intentId, matched ? 'verified' : 'under_review', 'SYSTEM', {
        expected: expected.toString(),
        observed: observed.toString(),
      });
      await this.audit.record(tx, {
        action: matched ? 'payment.verified' : 'payment.under_review',
        entityType: 'PaymentIntent',
        entityId: intentId,
        after: { expected: expected.toString(), observed: observed.toString() },
      });
    });

    if (matched && intent.assignedModemId) {
      await this.modems.release(intent.assignedModemId, { success: true, volumeGnf: expected.toString() });
    }
    if (!matched) {
      await this.alerts.raise('HIGH', 'RECONCILIATION_REQUIRED', `Payment ${intent.publicId} needs review`, {
        intentId,
      });
      if (intent.assignedModemId) await this.modems.release(intent.assignedModemId, { success: false });
    }
    return matched ? 'PAYMENT_VERIFIED' : 'UNDER_REVIEW';
  }

  async expireIntent(intentId: string): Promise<void> {
    await this.lock.withLock(`intent:${intentId}`, async () => {
      const intent = await this.entity(intentId);
      if (['PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'EXPIRED', 'CANCELLED'].includes(intent.status)) return;
      await this.prisma.runInTransaction(async (tx) => {
        await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'EXPIRED' } });
        await this.event(tx, intentId, 'expired', 'SYSTEM');
      });
      if (intent.assignedModemId) await this.modems.release(intent.assignedModemId, { success: false });
    });
  }

  async adminResolve(actorId: string, intentId: string, decision: 'VERIFY' | 'REJECT', reason: string) {
    const intent = await this.entity(intentId);
    await this.prisma.runInTransaction(async (tx) => {
      await tx.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: decision === 'VERIFY' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
          verifiedAt: decision === 'VERIFY' ? new Date() : null,
        },
      });
      await tx.reconciliation.updateMany({
        where: { intentId, status: { in: ['OPEN', 'MISMATCH', 'MANUAL_REVIEW'] } },
        data: { status: 'RESOLVED', reviewedBy: actorId, reviewedAt: new Date(), notes: reason },
      });
      await this.event(tx, intentId, `admin_${decision.toLowerCase()}`, 'ADMIN', { reason });
      await this.audit.record(tx, {
        action: `payment.admin_${decision.toLowerCase()}`,
        entityType: 'PaymentIntent',
        entityId: intentId,
        actorType: 'ADMIN',
        actorId,
        after: { reason },
      });
    });
    if (decision === 'VERIFY' && intent.assignedModemId) {
      await this.modems.release(intent.assignedModemId, { success: true, volumeGnf: intent.amount.toFixed() });
    }
    return this.entity(intentId);
  }

  // ---- reads ----
  async list(status?: string, page = 1, pageSize = 25) {
    const where = status ? { status: status as PaymentIntentStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.paymentIntent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentIntent.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async detail(id: string) {
    return this.prisma.paymentIntent.findUniqueOrThrow({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } }, reconciliations: true },
    });
  }
}
