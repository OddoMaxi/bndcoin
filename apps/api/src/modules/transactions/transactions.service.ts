import { Injectable } from '@nestjs/common';
import { ActorType, Prisma, TransactionStatus } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { paginated } from '../../common/dto/pagination.dto';
import { TreasuryService } from '../treasury/treasury.service';
import { BuyFlowService } from './buy-flow.service';
import { AdminTransitionDto, ListTransactionsQuery, ResolveReviewDto } from './dto';
import { TransactionStateMachine } from './state-machine/transaction-state-machine.service';
import { toTransactionDto } from './transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buyFlow: BuyFlowService,
    private readonly sm: TransactionStateMachine,
    private readonly treasury: TreasuryService,
    private readonly audit: AuditService,
    private readonly lock: RedisLockService,
    private readonly config: AppConfigService,
  ) {}

  private get requiredConfirmations() {
    return this.config.flow.requiredConfirmations;
  }

  async acceptQuote(
    userId: string,
    quoteId: string,
    destinationAddress: string,
    idempotencyKey?: string,
  ) {
    const tx = await this.buyFlow.createFromQuote(userId, quoteId, destinationAddress, idempotencyKey);
    return this.getDto(tx.id, userId);
  }

  async getDto(id: string, requesterId?: string, isAdmin = false) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!tx) throw new NotFoundError('Transaction', id);
    if (!isAdmin && requesterId && tx.userId !== requesterId) {
      throw new ForbiddenError('This transaction belongs to another user');
    }
    return toTransactionDto(tx, this.requiredConfirmations);
  }

  async listForUser(userId: string, q: ListTransactionsQuery) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(q.status ? { status: q.status as TransactionStatus } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return paginated(
      rows.map((t) => toTransactionDto(t, this.requiredConfirmations)),
      total,
      q,
    );
  }

  async cancel(userId: string, id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundError('Transaction', id);
    if (tx.userId !== userId) throw new ForbiddenError('This transaction belongs to another user');
    await this.buyFlow.cancel(id, userId, ActorType.USER);
    return this.getDto(id, userId);
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async adminList(q: ListTransactionsQuery) {
    const where: Prisma.TransactionWhereInput = {
      ...(q.status ? { status: q.status as TransactionStatus } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return paginated(
      rows.map((t) => toTransactionDto(t, this.requiredConfirmations)),
      total,
      q,
    );
  }

  async manualReviewQueue() {
    const rows = await this.prisma.transaction.findMany({
      where: { status: 'MANUAL_REVIEW' },
      orderBy: { updatedAt: 'asc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
      take: 100,
    });
    return rows.map((t) => toTransactionDto(t, this.requiredConfirmations));
  }

  /** Free-form admin transition (guarded by the state machine). */
  async adminTransition(actorId: string, id: string, dto: AdminTransitionDto) {
    await this.lock.withLock(`tx:${id}`, async () => {
      await this.sm.apply(id, {
        event: `admin:${dto.toStatus}`,
        toStatus: dto.toStatus as TransactionStatus,
        actorType: ActorType.ADMIN,
        actorId,
        reason: dto.reason,
        mutate: async (db) => this.treasuryForAdminTarget(db, id, dto.toStatus as TransactionStatus, dto.reason),
      });
    });
    return this.getDto(id, undefined, true);
  }

  /** Structured resolution of a MANUAL_REVIEW item. */
  async resolveReview(actorId: string, id: string, dto: ResolveReviewDto) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundError('Transaction', id);
    if (tx.status !== 'MANUAL_REVIEW') {
      throw new ValidationError('Only transactions in MANUAL_REVIEW can be resolved here');
    }

    switch (dto.decision) {
      case 'RETRY_USDT':
        await this.lock.withLock(`tx:${id}`, () =>
          this.sm.apply(id, {
            event: `admin:retry-usdt:${Date.now()}`,
            toStatus: 'USDT_PROCESSING',
            actorType: ActorType.ADMIN,
            actorId,
            reason: dto.reason,
          }),
        );
        await this.buyFlow.processUsdt(id);
        await this.buyFlow.confirmUsdt(id);
        break;
      case 'COMPLETE':
        await this.lock.withLock(`tx:${id}`, () =>
          this.sm.apply(id, {
            event: 'admin:complete',
            toStatus: 'COMPLETED',
            actorType: ActorType.ADMIN,
            actorId,
            reason: dto.reason,
            mutate: async (db, current) => {
              const held = await db.liquidityReservation.findFirst({
                where: { transactionId: id, asset: 'USDT', status: 'HELD' },
              });
              if (held) {
                await this.treasury.consumeReservation(db, held.id, `admin complete ${current.publicId}`);
              }
              return { completedAt: new Date() };
            },
          }),
        );
        break;
      case 'FAIL':
        await this.lock.withLock(`tx:${id}`, () =>
          this.sm.apply(id, {
            event: 'admin:fail',
            toStatus: 'FAILED',
            actorType: ActorType.ADMIN,
            actorId,
            reason: dto.reason,
            mutate: async (db) => {
              await this.releaseHeld(db, id, `admin fail: ${dto.reason}`);
              return { failureReason: dto.reason };
            },
          }),
        );
        break;
      case 'CANCEL':
        await this.lock.withLock(`tx:${id}`, () =>
          this.sm.apply(id, {
            event: 'admin:cancel',
            toStatus: 'CANCELLED',
            actorType: ActorType.ADMIN,
            actorId,
            reason: dto.reason,
            mutate: async (db) => {
              await this.releaseHeld(db, id, `admin cancel: ${dto.reason}`);
              return {};
            },
          }),
        );
        break;
    }
    return this.getDto(id, undefined, true);
  }

  private async releaseHeld(db: Prisma.TransactionClient, transactionId: string, reason: string) {
    const held = await db.liquidityReservation.findMany({
      where: { transactionId, status: 'HELD' },
    });
    for (const r of held) await this.treasury.releaseReservation(db, r.id, reason);
  }

  private async treasuryForAdminTarget(
    db: Prisma.TransactionClient,
    transactionId: string,
    target: TransactionStatus,
    reason: string,
  ): Promise<Prisma.TransactionUpdateInput> {
    if (target === 'COMPLETED') {
      const held = await db.liquidityReservation.findFirst({
        where: { transactionId, asset: 'USDT', status: 'HELD' },
      });
      if (held) await this.treasury.consumeReservation(db, held.id, `admin transition: ${reason}`);
      return { completedAt: new Date() };
    }
    if (target === 'FAILED' || target === 'CANCELLED') {
      await this.releaseHeld(db, transactionId, `admin transition: ${reason}`);
      return target === 'FAILED' ? { failureReason: reason } : {};
    }
    if (target === 'MANUAL_REVIEW') {
      return { manualReviewReason: reason };
    }
    return {};
  }
}
