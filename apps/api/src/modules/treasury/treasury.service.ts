import { Injectable, Logger } from '@nestjs/common';
import { Asset, LiquidityReservation } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import {
  ConflictError,
  InsufficientLiquidityError,
  NotFoundError,
} from '../../common/errors/domain-errors';
import { paginated, PaginationQuery } from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/util/decimal';

export const BUCKETS = {
  GNF: ['MAIN', 'PDV_01', 'PDV_02', 'IN_TRANSIT'],
  USDT: ['MAIN', 'HOT', 'COLD', 'IN_TRANSIT'],
} as const;

interface MoveInput {
  asset: Asset;
  bucket?: string;
  amount: string;
  refType: string;
  refId?: string;
  memo?: string;
}
interface ReserveInput extends MoveInput {
  reason: string;
}

/**
 * Treasury buckets are a fast cache of available/reserved balances plus a
 * reservation ledger. The double-entry LEDGER remains the financial source of
 * truth; `reconcile()` compares the two and alerts on drift.
 */
@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly alerts: AlertsService,
  ) {}

  async ensureAccounts(): Promise<void> {
    for (const asset of ['GNF', 'USDT'] as Asset[]) {
      for (const bucket of BUCKETS[asset]) {
        await this.prisma.treasuryAccount.upsert({
          where: { asset_bucket: { asset, bucket } },
          update: {},
          create: { asset, bucket },
        });
      }
    }
  }

  // ---- reads ----
  async getBalances() {
    const rows = await this.prisma.treasuryAccount.findMany({ orderBy: [{ asset: 'asc' }, { bucket: 'asc' }] });
    const byAsset: Record<string, any> = {};
    for (const asset of ['GNF', 'USDT'] as Asset[]) {
      const buckets = rows.filter((r) => r.asset === asset);
      const available = buckets.reduce((m, b) => m.add(Money.of(b.available.toFixed(), asset)), Money.zero(asset));
      const reserved = buckets.reduce((m, b) => m.add(Money.of(b.reserved.toFixed(), asset)), Money.zero(asset));
      byAsset[asset] = {
        asset,
        total: available.add(reserved).toString(),
        available: available.toString(),
        reserved: reserved.toString(),
        buckets: buckets.map((b) => ({
          bucket: b.bucket,
          available: toMoneyString(b.available, asset),
          reserved: toMoneyString(b.reserved, asset),
        })),
      };
    }
    return byAsset;
  }

  async openReservations() {
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

  // ---- transactional primitives (call with caller tx) ----
  private async movement(
    tx: Tx,
    accountId: string,
    asset: Asset,
    bucket: string,
    field: 'AVAILABLE' | 'RESERVED',
    direction: 'DEBIT' | 'CREDIT',
    amount: Money,
    balanceAfter: Money,
    refType: string,
    refId?: string,
    memo?: string,
  ) {
    await tx.treasuryMovement.create({
      data: {
        treasuryAccountId: accountId,
        asset,
        bucket,
        field,
        direction,
        amount: amount.toString(),
        balanceAfter: balanceAfter.toString(),
        refType,
        refId,
        memo,
      },
    });
  }

  async reserve(tx: Tx, input: ReserveInput): Promise<LiquidityReservation> {
    const bucket = input.bucket ?? 'MAIN';
    const acc = await this.prisma.lockTreasury(tx, input.asset, bucket);
    if (!acc) throw new NotFoundError('TreasuryAccount', `${input.asset}/${bucket}`);
    const amount = Money.of(input.amount, input.asset).assertPositive('reservation').quantize();
    const available = Money.of(acc.available, input.asset);
    if (available.lt(amount)) {
      throw new InsufficientLiquidityError(input.asset, amount.toString(), available.toString());
    }
    const newAvail = available.sub(amount);
    const newReserved = Money.of(acc.reserved, input.asset).add(amount);
    await tx.treasuryAccount.update({
      where: { id: acc.id },
      data: { available: newAvail.toString(), reserved: newReserved.toString(), version: { increment: 1 } },
    });
    const reservation = await tx.liquidityReservation.create({
      data: {
        treasuryAccountId: acc.id,
        asset: input.asset,
        amount: amount.toString(),
        status: 'HELD',
        refType: input.refType,
        refId: input.refId ?? '',
        reason: input.reason,
      },
    });
    await this.movement(tx, acc.id, input.asset, bucket, 'AVAILABLE', 'DEBIT', amount, newAvail, 'RESERVATION', reservation.id, input.reason);
    await this.audit.record(tx, {
      action: 'treasury.reserved',
      entityType: 'LiquidityReservation',
      entityId: reservation.id,
      after: { asset: input.asset, bucket, amount: amount.toString(), refType: input.refType, refId: input.refId },
    });
    return reservation;
  }

  async releaseReservation(tx: Tx, reservationId: string, reason: string) {
    const r = await tx.liquidityReservation.findUnique({ where: { id: reservationId } });
    if (!r) throw new NotFoundError('LiquidityReservation', reservationId);
    if (r.status !== 'HELD') return;
    const acc = await tx.treasuryAccount.findFirst({ where: { id: r.treasuryAccountId } });
    if (!acc) throw new NotFoundError('TreasuryAccount', r.treasuryAccountId);
    await this.prisma.lockTreasury(tx, acc.asset, acc.bucket);
    const amount = Money.of(r.amount.toFixed(), r.asset);
    const newAvail = Money.of(acc.available.toFixed(), r.asset).add(amount);
    const newReserved = Money.of(acc.reserved.toFixed(), r.asset).sub(amount).assertNonNegative('reserved');
    await tx.treasuryAccount.update({
      where: { id: acc.id },
      data: { available: newAvail.toString(), reserved: newReserved.toString(), version: { increment: 1 } },
    });
    await tx.liquidityReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    await this.movement(tx, acc.id, r.asset, acc.bucket, 'AVAILABLE', 'CREDIT', amount, newAvail, 'RESERVATION_RELEASE', reservationId, reason);
    await this.audit.record(tx, {
      action: 'treasury.reservation_released',
      entityType: 'LiquidityReservation',
      entityId: reservationId,
      after: { reason },
    });
  }

  async consumeReservation(tx: Tx, reservationId: string, reason: string) {
    const r = await tx.liquidityReservation.findUnique({ where: { id: reservationId } });
    if (!r) throw new NotFoundError('LiquidityReservation', reservationId);
    if (r.status === 'CONSUMED') return;
    if (r.status !== 'HELD') throw new ConflictError('RESERVATION_NOT_HELD', `Reservation ${reservationId} is ${r.status}`);
    const acc = await tx.treasuryAccount.findFirst({ where: { id: r.treasuryAccountId } });
    if (!acc) throw new NotFoundError('TreasuryAccount', r.treasuryAccountId);
    await this.prisma.lockTreasury(tx, acc.asset, acc.bucket);
    const amount = Money.of(r.amount.toFixed(), r.asset);
    const newReserved = Money.of(acc.reserved.toFixed(), r.asset).sub(amount).assertNonNegative('reserved');
    await tx.treasuryAccount.update({
      where: { id: acc.id },
      data: { reserved: newReserved.toString(), version: { increment: 1 } },
    });
    await tx.liquidityReservation.update({
      where: { id: reservationId },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });
    await this.movement(tx, acc.id, r.asset, acc.bucket, 'RESERVED', 'DEBIT', amount, newReserved, 'RESERVATION_CONSUME', reservationId, reason);
    await this.audit.record(tx, {
      action: 'treasury.reservation_consumed',
      entityType: 'LiquidityReservation',
      entityId: reservationId,
      after: { reason, amount: amount.toString() },
    });
  }

  async moveAvailable(tx: Tx, input: MoveInput, direction: 'CREDIT' | 'DEBIT') {
    const bucket = input.bucket ?? 'MAIN';
    const acc = await this.prisma.lockTreasury(tx, input.asset, bucket);
    if (!acc) throw new NotFoundError('TreasuryAccount', `${input.asset}/${bucket}`);
    const amount = Money.of(input.amount, input.asset).assertPositive('amount').quantize();
    const current = Money.of(acc.available, input.asset);
    const next = direction === 'CREDIT' ? current.add(amount) : current.sub(amount);
    if (direction === 'DEBIT' && next.isNegative()) {
      throw new InsufficientLiquidityError(input.asset, amount.toString(), current.toString());
    }
    await tx.treasuryAccount.update({
      where: { id: acc.id },
      data: { available: next.toString(), version: { increment: 1 } },
    });
    await this.movement(tx, acc.id, input.asset, bucket, 'AVAILABLE', direction, amount, next, input.refType, input.refId, input.memo);
  }

  async creditAvailable(tx: Tx, input: MoveInput) {
    return this.moveAvailable(tx, input, 'CREDIT');
  }
  async debitAvailable(tx: Tx, input: MoveInput) {
    return this.moveAvailable(tx, input, 'DEBIT');
  }

  /** Move available funds between two buckets of the same asset (e.g. COLD -> HOT). */
  async transfer(tx: Tx, asset: Asset, fromBucket: string, toBucket: string, amount: string, memo: string) {
    await this.debitAvailable(tx, { asset, bucket: fromBucket, amount, refType: 'TRANSFER', memo });
    await this.creditAvailable(tx, { asset, bucket: toBucket, amount, refType: 'TRANSFER', memo });
  }

  // ---- admin ----
  async adjust(actorId: string, asset: Asset, bucket: string, direction: 'CREDIT' | 'DEBIT', amount: string, memo: string) {
    await this.prisma.runInTransaction(async (tx) => {
      await this.moveAvailable(tx, { asset, bucket, amount, refType: 'ADJUSTMENT', memo }, direction);
      const assetAcc = asset === 'GNF' ? 'ASSET_GNF' : 'ASSET_USDT';
      const contra = asset === 'GNF' ? 'TREASURY_ADJUSTMENT' : 'TREASURY_ADJUSTMENT_USDT';
      await this.ledger.post(tx, {
        reference: `treasury_adjustment:${asset}/${bucket}`,
        referenceType: 'treasury_adjustment',
        referenceId: `${asset}-${bucket}-${Date.now()}`,
        memo,
        createdBy: actorId,
        lines:
          direction === 'CREDIT'
            ? [
                { account: assetAcc, currency: asset, direction: 'DEBIT', amount },
                { account: contra, currency: asset, direction: 'CREDIT', amount },
              ]
            : [
                { account: contra, currency: asset, direction: 'DEBIT', amount },
                { account: assetAcc, currency: asset, direction: 'CREDIT', amount },
              ],
      });
      await this.audit.record(tx, {
        action: 'treasury.adjusted',
        entityType: 'TreasuryAccount',
        entityId: `${asset}/${bucket}`,
        actorType: 'ADMIN',
        actorId,
        after: { asset, bucket, direction, amount, memo },
      });
    });
    return this.getBalances();
  }

  async listMovements(q: PaginationQuery & { asset?: string; bucket?: string }) {
    const where: Record<string, unknown> = {};
    if (q.asset) where.asset = q.asset;
    if (q.bucket) where.bucket = q.bucket;
    const [rows, total] = await Promise.all([
      this.prisma.treasuryMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.treasuryMovement.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({
        id: r.id,
        asset: r.asset,
        bucket: r.bucket,
        field: r.field,
        direction: r.direction,
        amount: toMoneyString(r.amount, r.asset),
        balanceAfter: toMoneyString(r.balanceAfter, r.asset),
        refType: r.refType,
        refId: r.refId,
        memo: r.memo,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      q,
    );
  }

  /** Compare treasury aggregate available+reserved against the ledger asset balance. */
  async reconcile() {
    const balances = await this.getBalances();
    const results: Record<string, unknown> = {};
    for (const asset of ['GNF', 'USDT'] as Asset[]) {
      const treasuryTotal = Money.of(balances[asset].total, asset);
      const ledgerCode = asset === 'GNF' ? 'ASSET_GNF' : 'ASSET_USDT';
      const ledgerBal = Money.of(await this.ledger.balance(ledgerCode), asset);
      const drift = treasuryTotal.sub(ledgerBal);
      results[asset] = {
        treasury: treasuryTotal.toString(),
        ledger: ledgerBal.toString(),
        drift: drift.toString(),
        ok: drift.isZero(),
      };
      if (!drift.isZero()) {
        await this.alerts.raise('HIGH', 'LEDGER_MISMATCH', `${asset} treasury/ledger drift ${drift.toString()}`, {
          asset,
        });
      }
    }
    return results;
  }
}
