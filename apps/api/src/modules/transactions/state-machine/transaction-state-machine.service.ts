import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma, Transaction, TransactionStatus } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';
import { PrismaService, Tx } from '../../../common/prisma/prisma.service';
import { assertTransition } from './transitions';

export interface ApplyInput {
  /** Deterministic event name. Combined with `toStatus` it is the idempotency key. */
  event: string;
  toStatus: TransactionStatus;
  actorType?: ActorType;
  actorId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Optional guard: only proceed if the current status is one of these. */
  expectedFrom?: TransactionStatus[];
  /**
   * Extra work performed inside the same transaction (treasury moves, provider
   * refs). Returns extra columns to write onto the Transaction row.
   */
  mutate?: (
    tx: Tx,
    current: Transaction,
  ) => Promise<Prisma.TransactionUpdateInput> | Prisma.TransactionUpdateInput;
}

/**
 * The only component that changes `Transaction.status`. Each call locks the
 * transaction row, validates the move against the transition table, runs the
 * optional side effect, then writes the new status + an append-only
 * TransactionEvent + an AuditLog — atomically.
 */
@Injectable()
export class TransactionStateMachine {
  private readonly logger = new Logger(TransactionStateMachine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async apply(transactionId: string, input: ApplyInput): Promise<Transaction> {
    return this.prisma.runInTransaction(async (tx) => {
      const locked = await this.prisma.lockTransaction(tx, transactionId);
      if (!locked) throw new NotFoundError('Transaction', transactionId);

      // Idempotent replay: this exact logical event already happened.
      const already = await tx.transactionEvent.findUnique({
        where: {
          transactionId_event_nextStatus: {
            transactionId,
            event: input.event,
            nextStatus: input.toStatus,
          },
        },
      });
      if (already) {
        this.logger.debug(`apply(${input.event}) replay for ${transactionId}`);
        return tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
      }

      const current = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });

      if (current.status === input.toStatus) {
        return current; // already there via a different path
      }
      if (input.expectedFrom && !input.expectedFrom.includes(current.status)) {
        throw new ConflictError(
          'UNEXPECTED_STATE',
          `Transaction ${transactionId} is ${current.status}, expected ${input.expectedFrom.join(' | ')}`,
        );
      }

      assertTransition(current.status, input.toStatus);

      const extra: Prisma.TransactionUpdateInput = (await input.mutate?.(tx, current)) ?? {};

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: input.toStatus, ...extra },
      });

      await tx.transactionEvent.create({
        data: {
          transactionId,
          previousStatus: current.status,
          nextStatus: input.toStatus,
          event: input.event,
          actorType: input.actorType ?? ActorType.SYSTEM,
          actorId: input.actorId ?? null,
          reason: input.reason,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      await this.audit.record(tx, {
        action: `transaction.${input.event}`,
        entityType: 'Transaction',
        entityId: transactionId,
        actorType: input.actorType ?? ActorType.SYSTEM,
        actorId: input.actorId ?? undefined,
        before: { status: current.status },
        after: { status: input.toStatus, reason: input.reason ?? null },
      });

      this.logger.log(
        `tx ${updated.publicId}: ${current.status} -> ${input.toStatus} (${input.event})`,
      );
      return updated;
    });
  }
}
