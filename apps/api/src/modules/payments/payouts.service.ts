import { Inject, Injectable, Logger } from '@nestjs/common';
import { Payout, PayoutStatus } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { payoutPublicId } from '../../common/util/public-id';
import { ORANGE_PROVIDER, OrangeMoneyProvider } from '../orange/orange-provider.interface';
import { ModemManager } from '../orange/modem-manager.service';

interface CreatePayoutInput {
  refType: string;
  refId: string;
  amountGnf: string;
  toPhone: string;
  idempotencyKey: string;
}

/**
 * GNF payout engine (SELL settlements, organiser settlements). Idempotent by
 * `idempotencyKey`; never runs the same money movement twice on retry.
 */
const MAX_PAYOUT_ATTEMPTS = 5;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    private readonly lock: RedisLockService,
    private readonly modems: ModemManager,
    @Inject(ORANGE_PROVIDER) private readonly orange: OrangeMoneyProvider,
  ) {}

  private entity(id: string) {
    return this.prisma.payout.findUniqueOrThrow({ where: { id } });
  }
  private async event(tx: Tx, payoutId: string, type: string, source: string, payload?: unknown) {
    await tx.payoutEvent.create({ data: { payoutId, type, source, payload: payload as never } });
  }

  async createOrGet(tx: Tx, input: CreatePayoutInput): Promise<Payout> {
    const existing = await tx.payout.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const payout = await tx.payout.create({
      data: {
        publicId: payoutPublicId(),
        refType: input.refType,
        refId: input.refId,
        method: 'ORANGE_MONEY',
        amount: Money.of(input.amountGnf, 'GNF').toString(),
        currency: 'GNF',
        toPhone: input.toPhone,
        status: 'PENDING',
        idempotencyKey: input.idempotencyKey,
      },
    });
    await this.event(tx, payout.id, 'created', 'SYSTEM', { refType: input.refType, refId: input.refId });
    return payout;
  }

  /** PENDING -> PROCESSING: allocate modem, initiate payout. */
  async process(payoutId: string): Promise<PayoutStatus> {
    return this.lock.withLock(`payout:${payoutId}`, async () => {
      const payout = await this.entity(payoutId);
      if (!['PENDING', 'RESERVED', 'FAILED'].includes(payout.status)) return payout.status;
      if (payout.status === 'FAILED') {
        if (payout.attempts >= MAX_PAYOUT_ATTEMPTS) {
          throw new Error(`Payout ${payout.publicId} exhausted ${MAX_PAYOUT_ATTEMPTS} attempts; escalate manually instead of retrying`);
        }
        await this.prisma.runInTransaction(async (tx) => {
          await tx.payout.update({ where: { id: payoutId }, data: { status: 'PENDING', failureReason: null } });
          await this.event(tx, payoutId, 'retry', 'ADMIN');
        });
      }

      const modemId = await this.prisma.runInTransaction((tx) =>
        this.modems.allocate(tx, payout.amount.toFixed(), 'PAYOUT'),
      );

      let externalReference: string;
      let providerStatus: 'PROCESSING' | 'PAID' | 'FAILED';
      try {
        const res = await this.orange.initiatePayout({
          payoutId,
          modemId,
          amount: payout.amount.toFixed(),
          toPhone: payout.toPhone,
          reference: payout.publicId,
        });
        externalReference = res.externalReference;
        providerStatus = res.status;
        await this.prisma.orangeSession.create({
          data: {
            modemId,
            kind: 'USSD',
            command: `PAYOUT ${payout.amount.toFixed()} ${payout.toPhone}`,
            response: `${providerStatus} ref=${externalReference}`,
            refType: 'payout',
            refId: payoutId,
            status: providerStatus === 'FAILED' ? 'FAILED' : 'SUCCESS',
            endedAt: new Date(),
          },
        });
      } catch (err) {
        await this.modems.release(modemId, { success: false });
        await this.prisma.runInTransaction(async (tx) => {
          await tx.payout.update({
            where: { id: payoutId },
            data: { status: 'FAILED', failureReason: (err as Error).message, attempts: { increment: 1 } },
          });
          await this.event(tx, payoutId, 'failed', 'MODEM', { error: (err as Error).message });
        });
        return 'FAILED';
      }

      await this.prisma.runInTransaction(async (tx) => {
        await tx.payout.update({
          where: { id: payoutId },
          data: {
            status: providerStatus === 'FAILED' ? 'FAILED' : 'PROCESSING',
            assignedModemId: modemId,
            externalReference,
            attempts: { increment: 1 },
          },
        });
        await this.event(tx, payoutId, 'processing', 'MODEM', { modemId, externalReference, providerStatus });
      });
      if (providerStatus === 'FAILED') {
        await this.modems.release(modemId, { success: false });
        return 'FAILED';
      }
      return this.confirm(payoutId);
    });
  }

  /** Poll the rail; PROCESSING -> PAID once the rail confirms. */
  async confirm(payoutId: string): Promise<PayoutStatus> {
    const payout = await this.entity(payoutId);
    if (payout.status === 'PAID') return 'PAID';
    if (payout.status !== 'PROCESSING' || !payout.externalReference) return payout.status;

    const status = await this.orange.checkStatus(payout.externalReference);
    if (status.status === 'PENDING') {
      await this.prisma.runInTransaction((tx) => this.event(tx, payoutId, 'poll_pending', 'MODEM'));
      return 'PROCESSING';
    }
    if (status.status === 'FAILED') {
      await this.prisma.runInTransaction(async (tx) => {
        await tx.payout.update({ where: { id: payoutId }, data: { status: 'FAILED', failureReason: 'rail reported failed' } });
        await this.event(tx, payoutId, 'failed', 'MODEM', status.raw);
      });
      if (payout.assignedModemId) await this.modems.release(payout.assignedModemId, { success: false });
      await this.alerts.raise('HIGH', 'PAYOUT_STUCK', `Payout ${payout.publicId} failed at the rail`, { payoutId });
      return 'FAILED';
    }

    await this.prisma.runInTransaction(async (tx) => {
      await tx.payout.update({ where: { id: payoutId }, data: { status: 'PAID', paidAt: new Date() } });
      await tx.reconciliation.create({
        data: {
          payoutId,
          kind: 'PAYOUT',
          status: 'MATCHED',
          expectedAmount: payout.amount.toFixed(),
          observedAmount: payout.amount.toFixed(),
          correlation: { reference: payout.externalReference, toPhone: payout.toPhone },
        },
      });
      await this.event(tx, payoutId, 'paid', 'MODEM', status);
      await this.audit.record(tx, {
        action: 'payout.paid',
        entityType: 'Payout',
        entityId: payoutId,
        after: { amount: payout.amount.toFixed(), toPhone: payout.toPhone },
      });
    });
    if (payout.assignedModemId) {
      await this.modems.release(payout.assignedModemId, { success: true, volumeGnf: payout.amount.toFixed() });
    }
    return 'PAID';
  }

  async list(status?: string, page = 1, pageSize = 25) {
    const where = status ? { status: status as PayoutStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.payout.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
