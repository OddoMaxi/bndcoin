import { Injectable } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { ValidationError, NotFoundError } from '../../common/errors/domain-errors';
import { settlementPublicId } from '../../common/util/public-id';
import { decimalToString } from '../../common/util/decimal';
import { PayoutsService } from '../payments/payouts.service';

interface AccrueInput {
  organizerId: string;
  eventId: string;
  grossGnf: string;
  platformFeeGnf: string;
  organizerNetGnf: string;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutsService,
  ) {}

  /** Accrue ticket-sale proceeds into a per-event PENDING settlement. */
  async accrue(tx: Tx, input: AccrueInput): Promise<void> {
    const existing = await tx.settlement.findFirst({
      where: { organizerId: input.organizerId, eventId: input.eventId, status: 'PENDING' },
    });
    if (existing) {
      await tx.settlement.update({
        where: { id: existing.id },
        data: {
          grossGnf: Money.of(decimalToString(existing.grossGnf), 'GNF').add(Money.of(input.grossGnf, 'GNF')).toString(),
          platformFeeGnf: Money.of(decimalToString(existing.platformFeeGnf), 'GNF').add(Money.of(input.platformFeeGnf, 'GNF')).toString(),
          organizerNetGnf: Money.of(decimalToString(existing.organizerNetGnf), 'GNF').add(Money.of(input.organizerNetGnf, 'GNF')).toString(),
        },
      });
      return;
    }
    await tx.settlement.create({
      data: {
        publicId: settlementPublicId(),
        organizerId: input.organizerId,
        eventId: input.eventId,
        grossGnf: input.grossGnf,
        platformFeeGnf: input.platformFeeGnf,
        organizerNetGnf: input.organizerNetGnf,
        status: 'PENDING',
      },
    });
  }

  list(status?: string) {
    return this.prisma.settlement.findMany({
      where: status ? { status: status as SettlementStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: { organizer: { select: { name: true, payoutMsisdn: true } }, event: { select: { title: true } } },
      take: 200,
    });
  }

  async approve(actorId: string, id: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundError('Settlement', id);
    if (s.status !== 'PENDING') throw new ValidationError('Only PENDING settlements can be approved');
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actorId },
    });
    await this.audit.recordStandalone({
      action: 'settlement.approved',
      entityType: 'Settlement',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
    });
    return updated;
  }

  async pay(actorId: string, id: string) {
    const s = await this.prisma.settlement.findUnique({
      where: { id },
      include: { organizer: true },
    });
    if (!s) throw new NotFoundError('Settlement', id);
    if (s.status !== 'APPROVED') throw new ValidationError('Settlement must be APPROVED before payout');
    if (!s.organizer.payoutMsisdn) throw new ValidationError('Organizer has no payout number set');

    const payout = await this.prisma.runInTransaction((tx) =>
      this.payouts.createOrGet(tx, {
        refType: 'settlement',
        refId: id,
        amountGnf: decimalToString(s.organizerNetGnf),
        toPhone: s.organizer.payoutMsisdn!,
        idempotencyKey: `settlement:${id}`,
      }),
    );
    await this.prisma.settlement.update({ where: { id }, data: { status: 'PROCESSING', payoutId: payout.id } });

    const status = await this.payouts.process(payout.id);
    if (status === 'PAID') {
      await this.prisma.runInTransaction(async (tx) => {
        await tx.settlement.update({
          where: { id },
          data: { status: 'PAID', settledGnf: decimalToString(s.organizerNetGnf) },
        });
        await this.ledger.post(tx, {
          reference: `settlement:${s.publicId}`,
          referenceType: 'settlement',
          referenceId: id,
          memo: 'Organizer settlement payout',
          createdBy: actorId,
          lines: [
            { account: 'ORGANIZER_PAYABLE', currency: 'GNF', direction: 'DEBIT', amount: decimalToString(s.organizerNetGnf) },
            { account: 'GNF_PDV_01', currency: 'GNF', direction: 'CREDIT', amount: decimalToString(s.organizerNetGnf) },
          ],
        });
        await this.audit.record(tx, {
          action: 'settlement.paid',
          entityType: 'Settlement',
          entityId: id,
          actorType: 'ADMIN',
          actorId,
          after: { amount: decimalToString(s.organizerNetGnf) },
        });
      });
    } else if (status === 'FAILED') {
      await this.prisma.settlement.update({ where: { id }, data: { status: 'FAILED' } });
    }
    return this.prisma.settlement.findUniqueOrThrow({ where: { id } });
  }
}
