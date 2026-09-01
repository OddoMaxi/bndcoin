import { Injectable } from '@nestjs/common';
import { Asset, LiquidityReservation } from '@prisma/client';
import { Money } from '@bn/money';
import { TreasuryBalanceDto } from '@bn/shared-types';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  ConflictError,
  InsufficientLiquidityError,
  NotFoundError,
} from '../../common/errors/domain-errors';
import { paginated, PaginationQuery } from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/util/decimal';
import { LedgerQuery, TreasuryAdjustDto } from './dto';

interface ReserveParams {
  asset: Asset;
  amount: string;
  reason: string;
  quoteId?: string;
  transactionId?: string;
}

interface MoveParams {
  asset: Asset;
  amount: string;
  refType: string;
  refId?: string;
  memo?: string;
}

/**
 * The treasury is the only place AVAILABLE / RESERVED balances change. Every
 * mutation locks the account row (`SELECT ... FOR UPDATE`), checks the invariant
 * `available >= 0` / `reserved >= 0`, and writes an append-only ledger row plus
 * an audit entry inside the caller's transaction.
 */
@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getBalances(): Promise<TreasuryBalanceDto[]> {
    const accounts = await this.prisma.treasuryAccount.findMany({ orderBy: { asset: 'asc' } });
    return accounts.map((a) => {
      const available = Money.of(a.available.toFixed(), a.asset);
      const reserved = Money.of(a.reserved.toFixed(), a.asset);
      return {
        asset: a.asset,
        available: available.toString(),
        reserved: reserved.toString(),
        total: available.add(reserved).toString(),
        updatedAt: a.updatedAt.toISOString(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Transactional primitives — always called with the caller's `tx`.
  // -------------------------------------------------------------------------

  async reserve(tx: Tx, params: ReserveParams): Promise<LiquidityReservation> {
    const account = await this.prisma.lockTreasuryAccount(tx, params.asset);
    if (!account) throw new NotFoundError('TreasuryAccount', params.asset);

    const amount = Money.of(params.amount, params.asset).assertPositive('reservation amount').quantize();
    const available = Money.of(account.available, params.asset);
    if (available.lt(amount)) {
      throw new InsufficientLiquidityError(params.asset, amount.toString(), available.toString());
    }

    const newAvailable = available.sub(amount);
    const newReserved = Money.of(account.reserved, params.asset).add(amount);

    await tx.treasuryAccount.update({
      where: { id: account.id },
      data: {
        available: newAvailable.toString(),
        reserved: newReserved.toString(),
        version: { increment: 1 },
      },
    });

    const reservation = await tx.liquidityReservation.create({
      data: {
        treasuryAccountId: account.id,
        asset: params.asset,
        amount: amount.toString(),
        status: 'HELD',
        quoteId: params.quoteId,
        transactionId: params.transactionId,
        reason: params.reason,
      },
    });

    await this.ledger(tx, {
      accountId: account.id,
      asset: params.asset,
      direction: 'DEBIT',
      bucket: 'AVAILABLE',
      amount,
      balanceAfterAvailable: newAvailable,
      balanceAfterReserved: newReserved,
      refType: 'RESERVATION',
      refId: reservation.id,
      memo: `reserve: ${params.reason}`,
    });

    await this.audit.record(tx, {
      action: 'treasury.reserved',
      entityType: 'LiquidityReservation',
      entityId: reservation.id,
      actorType: 'SYSTEM',
      after: { asset: params.asset, amount: amount.toString(), transactionId: params.transactionId },
    });

    return reservation;
  }

  async releaseReservation(tx: Tx, reservationId: string, reason: string): Promise<void> {
    const reservation = await tx.liquidityReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError('LiquidityReservation', reservationId);
    if (reservation.status !== 'HELD') return; // idempotent

    const account = await this.prisma.lockTreasuryAccount(tx, reservation.asset);
    if (!account) throw new NotFoundError('TreasuryAccount', reservation.asset);

    const amount = Money.of(reservation.amount.toFixed(), reservation.asset);
    const newAvailable = Money.of(account.available, reservation.asset).add(amount);
    const newReserved = Money.of(account.reserved, reservation.asset).sub(amount).assertNonNegative(
      'treasury reserved',
    );

    await tx.treasuryAccount.update({
      where: { id: account.id },
      data: {
        available: newAvailable.toString(),
        reserved: newReserved.toString(),
        version: { increment: 1 },
      },
    });
    await tx.liquidityReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await this.ledger(tx, {
      accountId: account.id,
      asset: reservation.asset,
      direction: 'CREDIT',
      bucket: 'AVAILABLE',
      amount,
      balanceAfterAvailable: newAvailable,
      balanceAfterReserved: newReserved,
      refType: 'RESERVATION_RELEASE',
      refId: reservationId,
      memo: `release: ${reason}`,
    });
    await this.audit.record(tx, {
      action: 'treasury.reservation_released',
      entityType: 'LiquidityReservation',
      entityId: reservationId,
      actorType: 'SYSTEM',
      after: { reason },
    });
  }

  async consumeReservation(tx: Tx, reservationId: string, reason: string): Promise<void> {
    const reservation = await tx.liquidityReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError('LiquidityReservation', reservationId);
    if (reservation.status === 'CONSUMED') return; // idempotent
    if (reservation.status !== 'HELD') {
      throw new ConflictError('RESERVATION_NOT_HELD', `Reservation ${reservationId} is ${reservation.status}`);
    }

    const account = await this.prisma.lockTreasuryAccount(tx, reservation.asset);
    if (!account) throw new NotFoundError('TreasuryAccount', reservation.asset);

    const amount = Money.of(reservation.amount.toFixed(), reservation.asset);
    const newReserved = Money.of(account.reserved, reservation.asset).sub(amount).assertNonNegative(
      'treasury reserved',
    );
    const available = Money.of(account.available, reservation.asset);

    await tx.treasuryAccount.update({
      where: { id: account.id },
      data: { reserved: newReserved.toString(), version: { increment: 1 } },
    });
    await tx.liquidityReservation.update({
      where: { id: reservationId },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });

    await this.ledger(tx, {
      accountId: account.id,
      asset: reservation.asset,
      direction: 'DEBIT',
      bucket: 'RESERVED',
      amount,
      balanceAfterAvailable: available,
      balanceAfterReserved: newReserved,
      refType: 'RESERVATION_CONSUME',
      refId: reservationId,
      memo: `consume: ${reason}`,
    });
    await this.audit.record(tx, {
      action: 'treasury.reservation_consumed',
      entityType: 'LiquidityReservation',
      entityId: reservationId,
      actorType: 'SYSTEM',
      after: { reason, amount: amount.toString() },
    });
  }

  async creditAvailable(tx: Tx, params: MoveParams): Promise<void> {
    await this.moveAvailable(tx, params, 'CREDIT');
  }

  async debitAvailable(tx: Tx, params: MoveParams): Promise<void> {
    await this.moveAvailable(tx, params, 'DEBIT');
  }

  private async moveAvailable(
    tx: Tx,
    params: MoveParams,
    direction: 'CREDIT' | 'DEBIT',
  ): Promise<void> {
    const account = await this.prisma.lockTreasuryAccount(tx, params.asset);
    if (!account) throw new NotFoundError('TreasuryAccount', params.asset);

    const amount = Money.of(params.amount, params.asset).assertPositive('amount').quantize();
    const current = Money.of(account.available, params.asset);
    const next = direction === 'CREDIT' ? current.add(amount) : current.sub(amount);
    if (direction === 'DEBIT' && next.isNegative()) {
      throw new InsufficientLiquidityError(params.asset, amount.toString(), current.toString());
    }
    const reserved = Money.of(account.reserved, params.asset);

    await tx.treasuryAccount.update({
      where: { id: account.id },
      data: { available: next.toString(), version: { increment: 1 } },
    });
    await this.ledger(tx, {
      accountId: account.id,
      asset: params.asset,
      direction,
      bucket: 'AVAILABLE',
      amount,
      balanceAfterAvailable: next,
      balanceAfterReserved: reserved,
      refType: params.refType,
      refId: params.refId,
      memo: params.memo,
    });
    await this.audit.record(tx, {
      action: `treasury.${direction.toLowerCase()}_available`,
      entityType: 'TreasuryAccount',
      entityId: account.id,
      actorType: 'SYSTEM',
      after: { asset: params.asset, amount: amount.toString(), refType: params.refType, refId: params.refId },
    });
  }

  private async ledger(
    tx: Tx,
    e: {
      accountId: string;
      asset: Asset;
      direction: 'CREDIT' | 'DEBIT';
      bucket: 'AVAILABLE' | 'RESERVED';
      amount: Money;
      balanceAfterAvailable: Money;
      balanceAfterReserved: Money;
      refType: string;
      refId?: string;
      memo?: string;
    },
  ): Promise<void> {
    await tx.treasuryLedgerEntry.create({
      data: {
        treasuryAccountId: e.accountId,
        asset: e.asset,
        direction: e.direction,
        bucket: e.bucket,
        amount: e.amount.toString(),
        balanceAfterAvailable: e.balanceAfterAvailable.toString(),
        balanceAfterReserved: e.balanceAfterReserved.toString(),
        refType: e.refType,
        refId: e.refId,
        memo: e.memo,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async adjust(actorId: string, dto: TreasuryAdjustDto): Promise<TreasuryBalanceDto> {
    await this.prisma.runInTransaction(async (tx) => {
      const move = {
        asset: dto.asset,
        amount: dto.amount,
        refType: 'ADJUSTMENT',
        memo: dto.memo,
      };
      if (dto.direction === 'CREDIT') await this.creditAvailable(tx, move);
      else await this.debitAvailable(tx, move);

      await this.audit.record(tx, {
        action: 'treasury.adjusted',
        entityType: 'TreasuryAccount',
        entityId: dto.asset,
        actorType: 'ADMIN',
        actorId,
        after: { asset: dto.asset, direction: dto.direction, amount: dto.amount, memo: dto.memo },
      });
    });
    const balances = await this.getBalances();
    return balances.find((b) => b.asset === dto.asset)!;
  }

  async listLedger(q: LedgerQuery) {
    const where = q.asset ? { asset: q.asset } : {};
    const [rows, total] = await Promise.all([
      this.prisma.treasuryLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.treasuryLedgerEntry.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      direction: r.direction,
      bucket: r.bucket,
      amount: toMoneyString(r.amount, r.asset),
      balanceAfterAvailable: toMoneyString(r.balanceAfterAvailable, r.asset),
      balanceAfterReserved: toMoneyString(r.balanceAfterReserved, r.asset),
      refType: r.refType,
      refId: r.refId,
      memo: r.memo,
      createdAt: r.createdAt.toISOString(),
    }));
    return paginated(items, total, q as PaginationQuery);
  }

  async openReservationsSummary() {
    const grouped = await this.prisma.liquidityReservation.groupBy({
      by: ['asset', 'status'],
      _sum: { amount: true },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      asset: g.asset,
      status: g.status,
      count: g._count._all,
      amount: g._sum.amount ? toMoneyString(g._sum.amount, g.asset) : '0',
    }));
  }
}
