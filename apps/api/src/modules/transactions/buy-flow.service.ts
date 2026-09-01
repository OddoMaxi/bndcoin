import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma, ProviderType, Transaction } from '@prisma/client';
import { Queue } from 'bullmq';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { ForbiddenError, ValidationError } from '../../common/errors/domain-errors';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { BUY_FLOW_JOB, QUEUE } from '../../common/queue/queue.constants';
import { decimalToString } from '../../common/util/decimal';
import { transactionPublicId } from '../../common/util/public-id';
import {
  CRYPTO_PROVIDER,
  CryptoProvider,
} from '../crypto-providers/crypto-provider.interface';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payment-providers/payment-provider.interface';
import { QuotesService } from '../quotes/quotes.service';
import { TreasuryService } from '../treasury/treasury.service';
import { TransactionStateMachine } from './state-machine/transaction-state-machine.service';

/**
 * Orchestrates the BUY USDT flow. Every step is idempotent and self-locking
 * (`tx:<id>` Redis lock); no step calls another self-locking step, so the lock
 * never needs to be re-entrant. `drive()` runs the forward chain and is safe to
 * call repeatedly.
 */
@Injectable()
export class BuyFlowService {
  private readonly logger = new Logger(BuyFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sm: TransactionStateMachine,
    private readonly treasury: TreasuryService,
    private readonly quotes: QuotesService,
    private readonly audit: AuditService,
    private readonly lock: RedisLockService,
    private readonly config: AppConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    @Inject(CRYPTO_PROVIDER) private readonly crypto: CryptoProvider,
    @InjectQueue(QUEUE.BUY_FLOW) private readonly queue: Queue,
  ) {}

  private entity(id: string): Promise<Transaction> {
    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Provider call wrapper — one ProviderOperation row per (transaction, op),
  // making outbound calls idempotent and auditable.
  // -------------------------------------------------------------------------
  private async providerCall<T extends { providerRef?: string; txHash?: string }>(
    providerType: ProviderType,
    providerKey: string,
    operation: string,
    transactionId: string,
    fn: () => Promise<T>,
    isSuccess: (result: T) => boolean = () => true,
  ): Promise<T> {
    const idempotencyKey = `${transactionId}:${operation}`;
    const existing = await this.prisma.providerOperation.findUnique({ where: { idempotencyKey } });
    // Only a SUCCESS op is replayed. A prior FAILED op is retried (e.g. an admin
    // cleared a provider outage and asked to retry the USDT leg).
    if (existing?.status === 'SUCCESS' && existing.response) {
      return existing.response as unknown as T;
    }
    const op =
      existing ??
      (await this.prisma.providerOperation
        .create({
          data: { providerType, providerKey, operation, transactionId, idempotencyKey, status: 'PENDING' },
        })
        .catch(() => this.prisma.providerOperation.findUniqueOrThrow({ where: { idempotencyKey } })));

    try {
      const result = await fn();
      await this.prisma.providerOperation.update({
        where: { id: op.id },
        data: {
          status: isSuccess(result) ? 'SUCCESS' : 'FAILED',
          response: result as unknown as Prisma.InputJsonValue,
          externalRef: result.providerRef ?? result.txHash ?? null,
          error: isSuccess(result) ? null : 'provider reported a failed result',
        },
      });
      return result;
    } catch (err) {
      await this.prisma.providerOperation.update({
        where: { id: op.id },
        data: { status: 'FAILED', error: (err as Error).message },
      });
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Step 1 — accept a quote -> CREATED -> QUOTE_LOCKED -> WAITING_PAYMENT
  // -------------------------------------------------------------------------
  async createFromQuote(
    userId: string,
    quoteId: string,
    destinationAddress: string,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    return this.lock.withLock(`quote:${quoteId}`, async () => {
      const pre = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        select: { transactionId: true, userId: true },
      });
      if (pre?.transactionId) {
        if (pre.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
        return this.entity(pre.transactionId);
      }

      if (!this.crypto.validateAddress(destinationAddress)) {
        throw new ValidationError('destinationAddress is not a valid USDT address');
      }

      const created = await this.prisma.runInTransaction(async (db) => {
        const quote = await this.quotes.lockForAccept(db, quoteId, userId);
        if (quote.status === 'ACCEPTED' && quote.transactionId) {
          return db.transaction.findUniqueOrThrow({ where: { id: quote.transactionId } });
        }

        const tx = await db.transaction.create({
          data: {
            publicId: transactionPublicId(),
            userId,
            type: 'BUY',
            status: 'CREATED',
            pair: quote.pair,
            marketRate: quote.marketRate,
            bnRate: quote.bnRate,
            feeGnf: quote.feeGnf,
            gnfAmount: quote.gnfAmount,
            usdtAmount: quote.usdtAmount,
            destinationAddress,
            paymentProviderKey: this.payment.key,
            cryptoProviderKey: this.crypto.key,
            idempotencyKey,
          },
        });

        // Reserve USDT so concurrent quotes cannot oversell the float.
        await this.treasury.reserve(db, {
          asset: 'USDT',
          amount: decimalToString(quote.usdtAmount),
          reason: `buy ${tx.publicId}`,
          quoteId: quote.id,
          transactionId: tx.id,
        });

        await this.quotes.markAccepted(db, quote.id, tx.id);

        await db.transactionEvent.create({
          data: {
            transactionId: tx.id,
            previousStatus: null,
            nextStatus: 'CREATED',
            event: 'created',
            actorType: ActorType.USER,
            actorId: userId,
          },
        });
        await this.audit.record(db, {
          action: 'transaction.created',
          entityType: 'Transaction',
          entityId: tx.id,
          actorType: ActorType.USER,
          actorId: userId,
          after: { quoteId: quote.id, usdtAmount: decimalToString(quote.usdtAmount) },
        });

        return tx;
      });

      if (created.status === 'CREATED') {
        await this.sm.apply(created.id, {
          event: 'quote-locked',
          toStatus: 'QUOTE_LOCKED',
          expectedFrom: ['CREATED'],
        });
        await this.startPayment(created.id);
        await this.queue.add(
          BUY_FLOW_JOB.PAYMENT_TIMEOUT,
          { transactionId: created.id },
          {
            delay: this.config.flow.paymentWindowSeconds * 1000,
            jobId: `timeout-${created.id}`,
          },
        );
      }

      return this.entity(created.id);
    });
  }

  // -------------------------------------------------------------------------
  // Step 2 — QUOTE_LOCKED -> WAITING_PAYMENT (issue collect)
  // -------------------------------------------------------------------------
  async startPayment(transactionId: string): Promise<void> {
    await this.lock.withLock(`tx:${transactionId}`, async () => {
      const tx = await this.entity(transactionId);
      if (tx.status !== 'QUOTE_LOCKED') return;

      const collect = await this.providerCall(
        ProviderType.PAYMENT,
        this.payment.key,
        'COLLECT',
        transactionId,
        () =>
          this.payment.collect({
            transactionId,
            amount: decimalToString(tx.gnfAmount),
            currency: 'GNF',
            payerPhone: tx.payerPhone ?? undefined,
            idempotencyKey: `${transactionId}:COLLECT`,
          }),
        (r) => r.status !== 'FAILED',
      );

      const paymentExpiresAt = new Date(Date.now() + this.config.flow.paymentWindowSeconds * 1000);
      await this.sm.apply(transactionId, {
        event: 'await-payment',
        toStatus: 'WAITING_PAYMENT',
        expectedFrom: ['QUOTE_LOCKED'],
        metadata: { providerRef: collect.providerRef },
        mutate: async () => ({
          paymentProviderRef: collect.providerRef,
          paymentExpiresAt,
        }),
      });
    });
  }

  // -------------------------------------------------------------------------
  // Step 3 — poll the payment rail and advance to PAYMENT_CONFIRMED
  // -------------------------------------------------------------------------
  async pollPayment(transactionId: string): Promise<void> {
    await this.lock.withLock(`tx:${transactionId}`, async () => {
      const tx = await this.entity(transactionId);
      if (!['WAITING_PAYMENT', 'PAYMENT_DETECTED'].includes(tx.status)) return;
      if (!tx.paymentProviderRef) return;

      const result = await this.payment.checkTransaction(tx.paymentProviderRef);

      switch (result.status) {
        case 'DETECTED':
          if (tx.status === 'WAITING_PAYMENT') {
            await this.sm.apply(transactionId, {
              event: 'payment-detected',
              toStatus: 'PAYMENT_DETECTED',
              expectedFrom: ['WAITING_PAYMENT'],
              actorType: ActorType.PROVIDER,
            });
          }
          break;
        case 'SETTLED':
          if (tx.status === 'WAITING_PAYMENT') {
            await this.sm.apply(transactionId, {
              event: 'payment-detected',
              toStatus: 'PAYMENT_DETECTED',
              expectedFrom: ['WAITING_PAYMENT'],
              actorType: ActorType.PROVIDER,
            });
          }
          await this.sm.apply(transactionId, {
            event: 'payment-confirmed',
            toStatus: 'PAYMENT_CONFIRMED',
            expectedFrom: ['PAYMENT_DETECTED'],
            actorType: ActorType.PROVIDER,
            mutate: async (db, current) => {
              await this.treasury.creditAvailable(db, {
                asset: 'GNF',
                amount: decimalToString(current.gnfAmount),
                refType: 'TRANSACTION',
                refId: transactionId,
                memo: `payment received ${current.publicId}`,
              });
              return {};
            },
          });
          break;
        case 'FAILED':
        case 'INSUFFICIENT_BALANCE':
          // No GNF received yet -> safe to fail and release the USDT reservation.
          await this.fail(transactionId, `Payment ${result.status.toLowerCase()}`);
          break;
        case 'EXPIRED':
          await this.expireCore(transactionId);
          break;
        case 'PENDING':
        default:
          break;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Step 4 — PAYMENT_CONFIRMED -> USDT_PROCESSING -> USDT_SENT
  // -------------------------------------------------------------------------
  async processUsdt(transactionId: string): Promise<void> {
    await this.lock.withLock(`tx:${transactionId}`, async () => {
      let tx = await this.entity(transactionId);
      if (tx.status === 'PAYMENT_CONFIRMED') {
        await this.sm.apply(transactionId, {
          event: 'usdt-processing',
          toStatus: 'USDT_PROCESSING',
          expectedFrom: ['PAYMENT_CONFIRMED'],
        });
        tx = await this.entity(transactionId);
      }
      if (tx.status !== 'USDT_PROCESSING') return;

      const send = await this.providerCall(
        ProviderType.CRYPTO,
        this.crypto.key,
        'SEND_USDT',
        transactionId,
        () =>
          this.crypto.sendUSDT({
            transactionId,
            toAddress: tx.destinationAddress,
            amount: decimalToString(tx.usdtAmount),
            idempotencyKey: `${transactionId}:SEND_USDT`,
          }),
        (r) => r.status !== 'FAILED',
      );

      if (send.status === 'FAILED') {
        await this.toManualReview(transactionId, 'USDT send failed at crypto provider');
        return;
      }

      await this.sm.apply(transactionId, {
        event: 'usdt-sent',
        toStatus: 'USDT_SENT',
        expectedFrom: ['USDT_PROCESSING'],
        metadata: { txHash: send.txHash },
        mutate: async () => ({ cryptoTxHash: send.txHash, cryptoConfirmations: 0 }),
      });

      await this.queue.add(
        BUY_FLOW_JOB.CONFIRM_USDT,
        { transactionId, attempt: 1 },
        { jobId: `confirm-${transactionId}-1`, delay: 2_000 },
      );
    });
  }

  // -------------------------------------------------------------------------
  // Step 5 — USDT_SENT -> COMPLETED once confirmations are in
  // -------------------------------------------------------------------------
  async confirmUsdt(transactionId: string): Promise<Transaction> {
    return this.lock.withLock(`tx:${transactionId}`, async () => {
      const tx = await this.entity(transactionId);
      if (tx.status === 'COMPLETED') return tx;
      if (tx.status !== 'USDT_SENT' || !tx.cryptoTxHash) return tx;

      const chain = await this.crypto.getTransaction(tx.cryptoTxHash);
      if (chain.status === 'FAILED') {
        await this.sm.apply(transactionId, {
          event: 'usdt-onchain-failed',
          toStatus: 'MANUAL_REVIEW',
          reason: 'On-chain transaction reported FAILED',
          mutate: async () => ({ manualReviewReason: 'On-chain transaction reported FAILED' }),
        });
        return this.entity(transactionId);
      }

      const required = this.config.flow.requiredConfirmations;
      if (chain.confirmations < required) {
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: { cryptoConfirmations: chain.confirmations },
        });
        return this.entity(transactionId);
      }

      await this.sm.apply(transactionId, {
        event: 'completed',
        toStatus: 'COMPLETED',
        expectedFrom: ['USDT_SENT'],
        mutate: async (db, current) => {
          const held = await db.liquidityReservation.findFirst({
            where: { transactionId, asset: 'USDT', status: 'HELD' },
          });
          if (held) {
            await this.treasury.consumeReservation(db, held.id, `completed ${current.publicId}`);
          }
          return { cryptoConfirmations: chain.confirmations, completedAt: new Date() };
        },
      });
      return this.entity(transactionId);
    });
  }

  /** Runs the whole forward chain; safe to call repeatedly. */
  async drive(transactionId: string): Promise<Transaction> {
    await this.pollPayment(transactionId);
    if ((await this.entity(transactionId)).status === 'PAYMENT_CONFIRMED') {
      await this.processUsdt(transactionId);
    }
    if ((await this.entity(transactionId)).status === 'USDT_SENT') {
      await this.confirmUsdt(transactionId);
    }
    return this.entity(transactionId);
  }

  // -------------------------------------------------------------------------
  // Terminal / exception paths
  // -------------------------------------------------------------------------
  private async releaseHeldReservations(db: Tx, transactionId: string, reason: string): Promise<void> {
    const held = await db.liquidityReservation.findMany({
      where: { transactionId, status: 'HELD' },
    });
    for (const r of held) {
      await this.treasury.releaseReservation(db, r.id, reason);
    }
  }

  async fail(transactionId: string, reason: string): Promise<void> {
    await this.sm.apply(transactionId, {
      event: 'failed',
      toStatus: 'FAILED',
      reason,
      mutate: async (db) => {
        await this.releaseHeldReservations(db, transactionId, `failed: ${reason}`);
        return { failureReason: reason };
      },
    });
  }

  /** Expire core — assumes the caller already holds `tx:<id>` (or none needed). */
  private async expireCore(transactionId: string): Promise<void> {
    const tx = await this.entity(transactionId);
    if (!['QUOTE_LOCKED', 'WAITING_PAYMENT', 'PAYMENT_DETECTED'].includes(tx.status)) return;
    await this.sm.apply(transactionId, {
      event: 'expired',
      toStatus: 'EXPIRED',
      reason: 'Payment window elapsed without settlement',
      mutate: async (db) => {
        await this.releaseHeldReservations(db, transactionId, 'payment window expired');
        return { failureReason: 'Payment not received in time' };
      },
    });
  }

  async expirePayment(transactionId: string, opts: { force?: boolean } = {}): Promise<void> {
    await this.lock.withLock(`tx:${transactionId}`, async () => {
      const tx = await this.entity(transactionId);
      if (!opts.force && tx.paymentExpiresAt && tx.paymentExpiresAt > new Date()) return;
      await this.expireCore(transactionId);
    });
  }

  async cancel(transactionId: string, actorId: string, actorType: ActorType = ActorType.USER): Promise<Transaction> {
    return this.lock.withLock(`tx:${transactionId}`, async () => {
      const tx = await this.entity(transactionId);
      if (!['CREATED', 'QUOTE_LOCKED', 'WAITING_PAYMENT'].includes(tx.status)) {
        throw new ValidationError(`A transaction in ${tx.status} can no longer be cancelled`);
      }
      await this.sm.apply(transactionId, {
        event: 'cancelled',
        toStatus: 'CANCELLED',
        actorType,
        actorId,
        reason: 'Cancelled before payment',
        mutate: async (db) => {
          await this.releaseHeldReservations(db, transactionId, 'cancelled before payment');
          return {};
        },
      });
      return this.entity(transactionId);
    });
  }

  async toManualReview(
    transactionId: string,
    reason: string,
    actorType: ActorType = ActorType.SYSTEM,
    actorId?: string,
  ): Promise<void> {
    await this.sm.apply(transactionId, {
      event: 'manual-review',
      toStatus: 'MANUAL_REVIEW',
      reason,
      actorType,
      actorId,
      mutate: async () => ({ manualReviewReason: reason }),
    });
  }
}
