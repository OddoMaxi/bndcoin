import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ActorType, CryptoOrder, CryptoOrderStatus, Prisma, QuoteSide } from '@prisma/client';
import { Queue } from 'bullmq';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { NotificationsService } from '../../common/notifications/notifications.service';
import { JOB, QUEUE } from '../../common/queue/queue.constants';
import { cryptoOrderPublicId } from '../../common/util/public-id';
import { decimalToString, toMoneyString } from '../../common/util/decimal';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { PricingService } from '../pricing/pricing.service';
import { TreasuryService } from '../treasury/treasury.service';
import { InventoryService } from '../suppliers/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutsService } from '../payments/payouts.service';
import { UsersService } from '../users/users.service';
import { BLOCKCHAIN_PROVIDER, BlockchainProvider } from './blockchain.provider';
import { CryptoNetworksService } from './crypto-networks.service';
import { tableFor } from './crypto-order.state';

interface ApplyInput {
  event: string;
  toStatus: CryptoOrderStatus;
  actorType?: ActorType;
  actorId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  mutate?: (tx: Tx, current: CryptoOrder) => Promise<Prisma.CryptoOrderUpdateInput> | Prisma.CryptoOrderUpdateInput;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly alerts: AlertsService,
    private readonly lock: RedisLockService,
    private readonly notifications: NotificationsService,
    private readonly pricing: PricingService,
    private readonly treasury: TreasuryService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly users: UsersService,
    private readonly networks: CryptoNetworksService,
    @Inject(BLOCKCHAIN_PROVIDER) private readonly chain: BlockchainProvider,
    @InjectQueue(QUEUE.CRYPTO) private readonly queue: Queue,
  ) {}

  private entity(id: string) {
    return this.prisma.cryptoOrder.findUniqueOrThrow({ where: { id } });
  }

  // ---- generic state transition ----
  async apply(orderId: string, input: ApplyInput): Promise<CryptoOrder> {
    return this.prisma.runInTransaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT 1 FROM "CryptoOrder" WHERE "id" = $1 FOR UPDATE', orderId);
      const already = await tx.cryptoOrderEvent.findUnique({
        where: { orderId_event_nextStatus: { orderId, event: input.event, nextStatus: input.toStatus } },
      });
      if (already) return tx.cryptoOrder.findUniqueOrThrow({ where: { id: orderId } });

      const current = await tx.cryptoOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (current.status === input.toStatus) return current;

      tableFor(current.side).assert(current.status, input.toStatus);
      const extra = (await input.mutate?.(tx, current)) ?? {};
      const updated = await tx.cryptoOrder.update({
        where: { id: orderId },
        data: { status: input.toStatus, ...extra },
      });
      await tx.cryptoOrderEvent.create({
        data: {
          orderId,
          previousStatus: current.status,
          nextStatus: input.toStatus,
          event: input.event,
          actorType: input.actorType ?? 'SYSTEM',
          actorId: input.actorId,
          reason: input.reason,
          metadata: input.metadata as never,
        },
      });
      await this.audit.record(tx, {
        action: `crypto_order.${input.event}`,
        entityType: 'CryptoOrder',
        entityId: orderId,
        actorType: input.actorType ?? 'SYSTEM',
        actorId: input.actorId ?? undefined,
        before: { status: current.status },
        after: { status: input.toStatus, reason: input.reason ?? null },
      });
      this.logger.log(`order ${updated.publicId}: ${current.status} -> ${input.toStatus} (${input.event})`);
      return updated;
    });
  }

  // ===================================================================== BUY
  async createBuyOrder(
    userId: string,
    quoteId: string,
    destinationAddress: string,
    networkId: string,
    idempotencyKey?: string,
  ): Promise<CryptoOrder> {
    return this.lock.withLock(`quote:${quoteId}`, async () => {
      const pre = await this.prisma.priceQuote.findUnique({ where: { id: quoteId }, include: { order: true } });
      if (pre?.order) {
        if (pre.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
        return this.entity(pre.order.id);
      }
      const net = await this.networks.getEnabledOrThrow(networkId);
      if (!this.chain.validateAddress(net.key, destinationAddress, net.addressRegex ?? undefined)) {
        throw new ValidationError('destinationAddress is not valid for the selected network');
      }

      const order = await this.prisma.runInTransaction(async (tx) => {
        const quote = await this.pricing.lockForOrder(tx, quoteId, userId);
        if (quote.side !== 'BUY_USDT') throw new ValidationError('Quote is not a BUY_USDT quote');
        await this.users.assertWithinLimits(userId, decimalToString(quote.gnfAmount), 'BUY_USDT');

        const created = await tx.cryptoOrder.create({
          data: {
            publicId: cryptoOrderPublicId(),
            userId,
            side: 'BUY_USDT',
            status: 'CREATED',
            quoteId: quote.id,
            referenceRate: quote.referenceRate,
            finalRate: quote.finalRate,
            feesGnf: quote.fees,
            gnfAmount: quote.gnfAmount,
            usdtAmount: quote.usdtAmount,
            networkId,
            destinationAddress,
            idempotencyKey,
          },
        });
        await tx.cryptoOrderEvent.create({
          data: { orderId: created.id, nextStatus: 'CREATED', event: 'created', actorType: 'USER', actorId: userId },
        });
        await this.pricing.markConsumed(tx, quote.id);
        return created;
      });

      // CREATED -> QUOTE_LOCKED -> USDT_RESERVED -> AWAITING_PAYMENT
      await this.apply(order.id, { event: 'quote-locked', toStatus: 'QUOTE_LOCKED' });
      await this.apply(order.id, {
        event: 'reserve-usdt',
        toStatus: 'USDT_RESERVED',
        mutate: async (tx, cur) => {
          await this.treasury.reserve(tx, {
            asset: 'USDT',
            bucket: 'HOT',
            amount: decimalToString(cur.usdtAmount),
            refType: 'crypto_order',
            refId: cur.id,
            reason: `buy ${cur.publicId}`,
          });
          return {};
        },
      });
      const intent = await this.prisma.runInTransaction((tx) =>
        this.payments.createIntent(tx, {
          refType: 'crypto_order',
          refId: order.id,
          userId,
          amountGnf: decimalToString(order.gnfAmount),
        }),
      );
      await this.prisma.cryptoOrder.update({ where: { id: order.id }, data: { paymentIntentId: intent.id } });
      await this.apply(order.id, { event: 'await-payment', toStatus: 'AWAITING_PAYMENT' });
      await this.payments.startCollection(intent.id);
      await this.queue.add(
        JOB.BUY_PAYMENT_TIMEOUT,
        { orderId: order.id },
        { delay: this.config.flow.paymentWindowSeconds * 1000, jobId: `buy-timeout-${order.id}` },
      );
      return this.entity(order.id);
    });
  }

  /** Idempotent forward chain for a BUY order. */
  async driveBuy(orderId: string): Promise<CryptoOrder> {
    const order = await this.entity(orderId);
    if (order.side !== 'BUY_USDT') return order;

    if (['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_RECONCILING'].includes(order.status) && order.paymentIntentId) {
      const status = await this.payments.pollIntent(order.paymentIntentId);
      if (status === 'PAYMENT_DETECTED' || status === 'PAYMENT_RECONCILING' || status === 'UNDER_REVIEW' || status === 'PAYMENT_VERIFIED') {
        if ((await this.entity(orderId)).status === 'AWAITING_PAYMENT') {
          await this.apply(orderId, { event: 'payment-detected', toStatus: 'PAYMENT_DETECTED', actorType: 'PROVIDER' });
        }
      }
      if (status === 'PAYMENT_VERIFIED') {
        if ((await this.entity(orderId)).status === 'PAYMENT_DETECTED') {
          await this.apply(orderId, { event: 'payment-reconciling', toStatus: 'PAYMENT_RECONCILING', actorType: 'PROVIDER' });
        }
        await this.apply(orderId, {
          event: 'payment-verified',
          toStatus: 'PAYMENT_VERIFIED',
          mutate: async (tx, cur) => {
            // GNF received into a PDV bucket.
            await this.treasury.creditAvailable(tx, {
              asset: 'GNF',
              bucket: 'PDV_01',
              amount: decimalToString(cur.gnfAmount),
              refType: 'crypto_order',
              refId: cur.id,
              memo: `buy payment ${cur.publicId}`,
            });
            return {};
          },
        });
      } else if (status === 'PAYMENT_REJECTED' || status === 'EXPIRED') {
        await this.failBuy(orderId, `Payment ${status.toLowerCase()}`);
        return this.entity(orderId);
      } else if (status === 'UNDER_REVIEW') {
        await this.apply(orderId, { event: 'payment-review', toStatus: 'UNDER_REVIEW', reason: 'Payment reconciliation mismatch', mutate: () => ({ reviewReason: 'Payment reconciliation mismatch' }) });
        return this.entity(orderId);
      } else {
        return this.entity(orderId);
      }
    }

    let cur = await this.entity(orderId);
    if (cur.status === 'PAYMENT_VERIFIED') {
      await this.apply(orderId, { event: 'usdt-processing', toStatus: 'USDT_PROCESSING' });
      cur = await this.entity(orderId);
    }

    if (cur.status === 'USDT_PROCESSING') {
      const net = await this.prisma.cryptoNetwork.findUniqueOrThrow({ where: { id: cur.networkId! } });
      const idemKey = `${orderId}:send`;
      const send = await this.chain.sendUsdt(net.key, cur.destinationAddress!, decimalToString(cur.usdtAmount), idemKey);
      if (!send.broadcast) {
        await this.apply(orderId, { event: 'usdt-send-review', toStatus: 'UNDER_REVIEW', reason: 'USDT broadcast failed', mutate: () => ({ reviewReason: 'USDT broadcast failed' }) });
        await this.alerts.raise('HIGH', 'PAYOUT_STUCK', `USDT send failed for ${cur.publicId}`);
        return this.entity(orderId);
      }
      await this.prisma.cryptoWithdrawal.create({
        data: {
          orderId,
          networkId: net.id,
          asset: 'USDT',
          toAddress: cur.destinationAddress!,
          amount: decimalToString(cur.usdtAmount),
          txHash: send.txHash,
          status: 'BROADCAST',
          idempotencyKey: idemKey,
          broadcastAt: new Date(),
        },
      });
      await this.apply(orderId, { event: 'usdt-sent', toStatus: 'USDT_SENT', metadata: { txHash: send.txHash }, mutate: () => ({}) });
      await this.queue.add(JOB.WITHDRAWAL_CONFIRM, { orderId, attempt: 1 }, { jobId: `wd-${orderId}-1`, delay: 2000 });
      cur = await this.entity(orderId);
    }

    if (cur.status === 'USDT_SENT') {
      const wd = await this.prisma.cryptoWithdrawal.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
      if (wd?.txHash) {
        const net = await this.prisma.cryptoNetwork.findUniqueOrThrow({ where: { id: wd.networkId } });
        const chainTx = await this.chain.getTransaction(net.key, wd.txHash);
        await this.prisma.cryptoWithdrawal.update({
          where: { id: wd.id },
          data: { confirmations: chainTx.confirmations, status: chainTx.status === 'CONFIRMED' ? 'CONFIRMED' : 'CONFIRMING' },
        });
        if (chainTx.status === 'FAILED') {
          await this.apply(orderId, { event: 'usdt-onchain-failed', toStatus: 'UNDER_REVIEW', reason: 'On-chain send failed', mutate: () => ({ reviewReason: 'On-chain send failed' }) });
          return this.entity(orderId);
        }
        if (chainTx.confirmations >= this.config.flow.requiredConfirmations) {
          await this.completeBuy(orderId, wd.txHash, chainTx.confirmations);
        }
      }
    }
    return this.entity(orderId);
  }

  private async completeBuy(orderId: string, txHash: string, confirmations: number) {
    await this.apply(orderId, {
      event: 'completed',
      toStatus: 'COMPLETED',
      mutate: async (tx, cur) => {
        const held = await tx.liquidityReservation.findFirst({
          where: { refType: 'crypto_order', refId: orderId, asset: 'USDT', status: 'HELD' },
        });
        if (held) await this.treasury.consumeReservation(tx, held.id, `buy complete ${cur.publicId}`);
        const cogs = await this.inventory.consumeFifo(
          tx,
          decimalToString(cur.usdtAmount),
          decimalToString(cur.finalRate),
        );
        const gnf = Money.of(decimalToString(cur.gnfAmount), 'GNF');
        const fees = Money.of(decimalToString(cur.feesGnf), 'GNF');
        const margin = gnf.sub(Money.of(cogs, 'GNF')).sub(fees);
        // GNF leg
        await this.ledger.post(tx, {
          reference: `crypto_order:${cur.publicId}`,
          referenceType: 'crypto_order',
          referenceId: orderId,
          memo: 'BUY_USDT settlement (GNF leg)',
          lines: [
            { account: 'GNF_PDV_01', currency: 'GNF', direction: 'DEBIT', amount: gnf.toString() },
            { account: 'COGS_USDT', currency: 'GNF', direction: 'CREDIT', amount: cogs },
            { account: 'FEES_REVENUE', currency: 'GNF', direction: 'CREDIT', amount: fees.toString() },
            { account: 'TRADING_MARGIN', currency: 'GNF', direction: 'CREDIT', amount: margin.abs().toString() },
          ].filter((l) => !Money.of(l.amount, 'GNF').isZero()),
        });
        // USDT leg (physical outflow; value captured above in GNF leg)
        await this.ledger.post(tx, {
          reference: `crypto_order:${cur.publicId}:usdt`,
          referenceType: 'crypto_order',
          referenceId: orderId,
          memo: 'BUY_USDT settlement (USDT leg)',
          lines: [
            { account: 'TREASURY_ADJUSTMENT_USDT', currency: 'USDT', direction: 'DEBIT', amount: decimalToString(cur.usdtAmount) },
            { account: 'USDT_HOT_WALLET', currency: 'USDT', direction: 'CREDIT', amount: decimalToString(cur.usdtAmount) },
          ],
        });
        return { cogsGnf: cogs, marginGnf: margin.toString(), completedAt: new Date() };
      },
    });
    const o = await this.entity(orderId);
    await this.notifications.send({
      userId: o.userId,
      channel: 'SMS',
      template: 'TRANSACTION_COMPLETED',
      destination: '',
      payload: { publicId: o.publicId, usdt: decimalToString(o.usdtAmount) },
    });
  }

  async failBuy(orderId: string, reason: string) {
    await this.apply(orderId, {
      event: 'failed',
      toStatus: 'FAILED',
      reason,
      mutate: async (tx) => {
        const held = await tx.liquidityReservation.findMany({
          where: { refType: 'crypto_order', refId: orderId, status: 'HELD' },
        });
        for (const h of held) await this.treasury.releaseReservation(tx, h.id, `failed: ${reason}`);
        return { failureReason: reason };
      },
    });
  }

  async expireBuy(orderId: string) {
    const order = await this.entity(orderId);
    if (!['QUOTE_LOCKED', 'USDT_RESERVED', 'AWAITING_PAYMENT'].includes(order.status)) return;
    if (order.paymentIntentId) await this.payments.expireIntent(order.paymentIntentId);
    await this.apply(orderId, {
      event: 'expired',
      toStatus: 'EXPIRED',
      reason: 'Payment window elapsed',
      mutate: async (tx) => {
        const held = await tx.liquidityReservation.findMany({
          where: { refType: 'crypto_order', refId: orderId, status: 'HELD' },
        });
        for (const h of held) await this.treasury.releaseReservation(tx, h.id, 'payment expired');
        return { failureReason: 'Payment not received in time' };
      },
    });
  }

  // ==================================================================== SELL
  async createSellOrder(userId: string, quoteId: string, networkId: string): Promise<CryptoOrder> {
    return this.lock.withLock(`quote:${quoteId}`, async () => {
      const pre = await this.prisma.priceQuote.findUnique({ where: { id: quoteId }, include: { order: true } });
      if (pre?.order) {
        if (pre.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
        return this.entity(pre.order.id);
      }
      const net = await this.networks.getEnabledOrThrow(networkId);

      const order = await this.prisma.runInTransaction(async (tx) => {
        const quote = await this.pricing.lockForOrder(tx, quoteId, userId);
        if (quote.side !== 'SELL_USDT') throw new ValidationError('Quote is not a SELL_USDT quote');
        await this.users.assertWithinLimits(userId, decimalToString(quote.gnfAmount), 'SELL_USDT');

        // GNF treasury availability check (soft — hard reservation happens after crypto confirmed)
        const balances = await this.treasury.getBalances();
        if (Money.of(balances['GNF'].available, 'GNF').lt(Money.of(decimalToString(quote.gnfAmount), 'GNF'))) {
          throw new ValidationError('Insufficient GNF liquidity for this sell right now');
        }

        const dep = await this.chain.deriveDepositAddress(net.key, quote.publicId);
        const created = await tx.cryptoOrder.create({
          data: {
            publicId: cryptoOrderPublicId(),
            userId,
            side: 'SELL_USDT',
            status: 'CREATED',
            quoteId: quote.id,
            referenceRate: quote.referenceRate,
            finalRate: quote.finalRate,
            feesGnf: quote.fees,
            gnfAmount: quote.gnfAmount,
            usdtAmount: quote.usdtAmount,
            networkId,
            depositAddress: dep.address,
          },
        });
        await tx.walletAddress.create({
          data: {
            networkId: net.id,
            asset: 'USDT',
            kind: 'DEPOSIT',
            address: dep.address,
            derivationRef: dep.derivationRef,
            assignedRefType: 'crypto_order',
            assignedRefId: created.id,
          },
        });
        await tx.cryptoDeposit.create({
          data: {
            orderId: created.id,
            networkId: net.id,
            asset: 'USDT',
            address: dep.address,
            amount: decimalToString(quote.usdtAmount),
            status: 'PENDING',
          },
        });
        await tx.cryptoOrderEvent.create({
          data: { orderId: created.id, nextStatus: 'CREATED', event: 'created', actorType: 'USER', actorId: userId },
        });
        await this.pricing.markConsumed(tx, quote.id);
        return created;
      });

      await this.apply(order.id, { event: 'quote-locked', toStatus: 'QUOTE_LOCKED' });
      await this.apply(order.id, { event: 'await-crypto', toStatus: 'AWAITING_CRYPTO' });
      await this.queue.add(JOB.SELL_WATCH_DEPOSIT, { orderId: order.id, attempt: 1 }, { jobId: `sell-watch-${order.id}-1`, delay: 3000 });
      await this.queue.add(
        JOB.SELL_DEPOSIT_TIMEOUT,
        { orderId: order.id },
        { delay: this.config.flow.paymentWindowSeconds * 1000, jobId: `sell-timeout-${order.id}` },
      );
      return this.entity(order.id);
    });
  }

  /** Idempotent forward chain for a SELL order. */
  async driveSell(orderId: string): Promise<CryptoOrder> {
    let cur = await this.entity(orderId);
    if (cur.side !== 'SELL_USDT') return cur;
    const net = await this.prisma.cryptoNetwork.findUniqueOrThrow({ where: { id: cur.networkId! } });

    if (['AWAITING_CRYPTO', 'CRYPTO_DETECTED', 'CONFIRMING'].includes(cur.status)) {
      const dep = await this.prisma.cryptoDeposit.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
      if (!dep) return cur;
      const incoming = await this.chain.getIncoming(net.key, cur.depositAddress!, decimalToString(cur.usdtAmount), (cur.quoteId ?? cur.id));
      // deposit scenarios keyed by quote publicId
      const incoming2 =
        incoming ??
        (await this.chain.getIncoming(net.key, cur.depositAddress!, decimalToString(cur.usdtAmount), await this.quotePublicId(cur.quoteId)));
      if (!incoming2) return cur;

      const expected = Money.of(decimalToString(cur.usdtAmount), 'USDT');
      const observed = Money.of(incoming2.amount, 'USDT');
      await this.prisma.cryptoDeposit.update({
        where: { id: dep.id },
        data: {
          txHash: incoming2.txHash,
          confirmations: incoming2.confirmations,
          status: incoming2.status === 'CONFIRMED' ? 'CONFIRMED' : 'CONFIRMING',
          detectedAt: dep.detectedAt ?? new Date(),
          confirmedAt: incoming2.status === 'CONFIRMED' ? new Date() : null,
        },
      });

      if (!expected.eq(observed)) {
        await this.apply(orderId, { event: 'deposit-mismatch', toStatus: 'UNDER_REVIEW', reason: 'Deposit amount mismatch', mutate: () => ({ reviewReason: 'Deposit amount mismatch' }) });
        await this.alerts.raise('HIGH', 'RECONCILIATION_REQUIRED', `SELL ${cur.publicId} deposit amount mismatch`);
        return this.entity(orderId);
      }

      if (cur.status === 'AWAITING_CRYPTO') {
        await this.apply(orderId, { event: 'crypto-detected', toStatus: 'CRYPTO_DETECTED', actorType: 'PROVIDER' });
        cur = await this.entity(orderId);
      }
      if (cur.status === 'CRYPTO_DETECTED') {
        await this.apply(orderId, { event: 'confirming', toStatus: 'CONFIRMING', actorType: 'PROVIDER' });
        cur = await this.entity(orderId);
      }
      if (cur.status === 'CONFIRMING' && incoming2.confirmations >= this.config.flow.requiredConfirmations) {
        await this.apply(orderId, {
          event: 'crypto-confirmed',
          toStatus: 'CRYPTO_CONFIRMED',
          actorType: 'PROVIDER',
          mutate: async (tx, c) => {
            // USDT received into hot wallet + new inventory lot at the price we paid.
            await this.treasury.creditAvailable(tx, {
              asset: 'USDT',
              bucket: 'HOT',
              amount: decimalToString(c.usdtAmount),
              refType: 'crypto_order',
              refId: c.id,
              memo: `sell deposit ${c.publicId}`,
            });
            await this.inventory.addLot(tx, {
              sourceType: 'SELL_ORDER',
              sourceRef: c.publicId,
              quantity: decimalToString(c.usdtAmount),
              unitCostGnf: decimalToString(c.finalRate),
            });
            await this.ledger.post(tx, {
              reference: `crypto_order:${c.publicId}:usdt`,
              referenceType: 'crypto_order',
              referenceId: orderId,
              memo: 'SELL_USDT deposit (USDT leg)',
              lines: [
                { account: 'USDT_HOT_WALLET', currency: 'USDT', direction: 'DEBIT', amount: decimalToString(c.usdtAmount) },
                { account: 'TREASURY_ADJUSTMENT_USDT', currency: 'USDT', direction: 'CREDIT', amount: decimalToString(c.usdtAmount) },
              ],
            });
            return {};
          },
        });
        cur = await this.entity(orderId);
      }
    }

    if (cur.status === 'CRYPTO_CONFIRMED') {
      await this.apply(orderId, {
        event: 'reserve-gnf',
        toStatus: 'GNF_RESERVED',
        mutate: async (tx, c) => {
          await this.treasury.reserve(tx, {
            asset: 'GNF',
            bucket: 'PDV_01',
            amount: decimalToString(c.gnfAmount),
            refType: 'crypto_order',
            refId: c.id,
            reason: `sell payout ${c.publicId}`,
          });
          return {};
        },
      });
      cur = await this.entity(orderId);
    }

    if (cur.status === 'GNF_RESERVED') {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: cur.userId } });
      const payout = await this.prisma.runInTransaction((tx) =>
        this.payouts.createOrGet(tx, {
          refType: 'crypto_order',
          refId: orderId,
          amountGnf: decimalToString(cur.gnfAmount),
          toPhone: user.phone,
          idempotencyKey: `crypto_order:${orderId}`,
        }),
      );
      await this.prisma.cryptoOrder.update({ where: { id: orderId }, data: { payoutId: payout.id } });
      await this.apply(orderId, { event: 'payout-pending', toStatus: 'PAYOUT_PENDING' });
      cur = await this.entity(orderId);
    }

    if (cur.status === 'PAYOUT_PENDING' || cur.status === 'PAYOUT_PROCESSING') {
      if (cur.status === 'PAYOUT_PENDING') {
        await this.apply(orderId, { event: 'payout-processing', toStatus: 'PAYOUT_PROCESSING' });
      }
      const status = await this.payouts.process(cur.payoutId!);
      if (status === 'PAID') {
        await this.completeSell(orderId);
      } else if (status === 'FAILED') {
        await this.apply(orderId, { event: 'payout-failed-review', toStatus: 'UNDER_REVIEW', reason: 'Payout failed', mutate: () => ({ reviewReason: 'Payout failed at the rail' }) });
      }
    }
    return this.entity(orderId);
  }

  private async quotePublicId(quoteId: string | null): Promise<string> {
    if (!quoteId) return '';
    const q = await this.prisma.priceQuote.findUnique({ where: { id: quoteId } });
    return q?.publicId ?? '';
  }

  private async completeSell(orderId: string) {
    await this.apply(orderId, {
      event: 'completed',
      toStatus: 'COMPLETED',
      mutate: async (tx, cur) => {
        const held = await tx.liquidityReservation.findFirst({
          where: { refType: 'crypto_order', refId: orderId, asset: 'GNF', status: 'HELD' },
        });
        if (held) await this.treasury.consumeReservation(tx, held.id, `sell complete ${cur.publicId}`);
        const gross = Money.of(decimalToString(cur.gnfAmount), 'GNF').add(Money.of(decimalToString(cur.feesGnf), 'GNF'));
        await this.ledger.post(tx, {
          reference: `crypto_order:${cur.publicId}:gnf`,
          referenceType: 'crypto_order',
          referenceId: orderId,
          memo: 'SELL_USDT settlement (GNF leg)',
          lines: [
            { account: 'TREASURY_ADJUSTMENT', currency: 'GNF', direction: 'DEBIT', amount: gross.toString() },
            { account: 'GNF_PDV_01', currency: 'GNF', direction: 'CREDIT', amount: decimalToString(cur.gnfAmount) },
            { account: 'FEES_REVENUE', currency: 'GNF', direction: 'CREDIT', amount: decimalToString(cur.feesGnf) },
          ].filter((l) => !Money.of(l.amount, 'GNF').isZero()),
        });
        return { completedAt: new Date() };
      },
    });
  }

  async expireSell(orderId: string) {
    const order = await this.entity(orderId);
    if (!['QUOTE_LOCKED', 'AWAITING_CRYPTO'].includes(order.status)) return;
    await this.apply(orderId, { event: 'expired', toStatus: 'EXPIRED', reason: 'No deposit received in time' });
  }

  // ---- admin transition / review ----
  async adminTransition(actorId: string, orderId: string, toStatus: CryptoOrderStatus, reason: string) {
    await this.apply(orderId, {
      event: `admin:${toStatus}`,
      toStatus,
      actorType: 'ADMIN',
      actorId,
      reason,
      mutate: async (tx) => {
        if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(toStatus)) {
          const held = await tx.liquidityReservation.findMany({
            where: { refType: 'crypto_order', refId: orderId, status: 'HELD' },
          });
          for (const h of held) await this.treasury.releaseReservation(tx, h.id, `admin ${toStatus}`);
          return { failureReason: reason };
        }
        return {};
      },
    });
    const order = await this.entity(orderId);
    if (order.status === 'PAYMENT_VERIFIED' || order.status === 'USDT_PROCESSING') await this.driveBuy(orderId);
    if (['GNF_RESERVED', 'PAYOUT_PENDING'].includes(order.status)) await this.driveSell(orderId);
    return this.getOrderDto(orderId);
  }

  // ---- queries ----
  async getOrderDto(id: string, requesterId?: string, isAdmin = false) {
    const o = await this.prisma.cryptoOrder.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } }, deposits: true, withdrawals: true, paymentIntent: true, payout: true },
    });
    if (!o) throw new NotFoundError('CryptoOrder', id);
    if (!isAdmin && requesterId && o.userId !== requesterId) throw new ForbiddenError('This order belongs to another user');
    return {
      id: o.id,
      publicId: o.publicId,
      side: o.side,
      status: o.status,
      finalRate: decimalToString(o.finalRate),
      feesGnf: toMoneyString(o.feesGnf, 'GNF'),
      gnfAmount: toMoneyString(o.gnfAmount, 'GNF'),
      usdtAmount: toMoneyString(o.usdtAmount, 'USDT'),
      destinationAddress: o.destinationAddress,
      depositAddress: o.depositAddress,
      networkId: o.networkId,
      cryptoTxHash: o.withdrawals[0]?.txHash ?? o.deposits[0]?.txHash ?? null,
      requiredConfirmations: this.config.flow.requiredConfirmations,
      confirmations: o.withdrawals[0]?.confirmations ?? o.deposits[0]?.confirmations ?? 0,
      failureReason: o.failureReason,
      reviewReason: o.reviewReason,
      paymentIntent: o.paymentIntent
        ? {
            publicId: o.paymentIntent.publicId,
            status: o.paymentIntent.status,
            amount: toMoneyString(o.paymentIntent.amount, 'GNF'),
            reference: o.paymentIntent.externalReference,
          }
        : null,
      payout: o.payout ? { publicId: o.payout.publicId, status: o.payout.status } : null,
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
      events: o.events.map((e) => ({
        nextStatus: e.nextStatus,
        event: e.event,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  async listForUser(userId: string, page = 1) {
    const pageSize = 25;
    const [items, total] = await Promise.all([
      this.prisma.cryptoOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.cryptoOrder.count({ where: { userId } }),
    ]);
    return { items: items.map((o) => this.listRow(o)), total, page, pageSize };
  }

  async adminList(filter: { side?: string; status?: string; page?: number }) {
    const pageSize = 25;
    const page = filter.page ?? 1;
    const where: Prisma.CryptoOrderWhereInput = {};
    if (filter.side) where.side = filter.side as QuoteSide;
    if (filter.status) where.status = filter.status as CryptoOrderStatus;
    const [items, total] = await Promise.all([
      this.prisma.cryptoOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.cryptoOrder.count({ where }),
    ]);
    return { items: items.map((o) => this.listRow(o)), total, page, pageSize };
  }

  private listRow(o: CryptoOrder) {
    return {
      id: o.id,
      publicId: o.publicId,
      side: o.side,
      status: o.status,
      gnfAmount: toMoneyString(o.gnfAmount, 'GNF'),
      usdtAmount: toMoneyString(o.usdtAmount, 'USDT'),
      finalRate: decimalToString(o.finalRate),
      createdAt: o.createdAt.toISOString(),
    };
  }

  async expireStaleOrders(): Promise<number> {
    const stale = await this.prisma.cryptoOrder.findMany({
      where: {
        status: { in: ['CREATED', 'QUOTE_LOCKED', 'USDT_RESERVED', 'AWAITING_PAYMENT', 'AWAITING_CRYPTO'] },
        createdAt: { lt: new Date(Date.now() - (this.config.flow.paymentWindowSeconds + 120) * 1000) },
      },
      select: { id: true, side: true },
      take: 200,
    });
    for (const o of stale) {
      try {
        if (o.side === 'BUY_USDT') await this.expireBuy(o.id);
        else await this.expireSell(o.id);
      } catch (err) {
        this.logger.warn(`expire ${o.id}: ${(err as Error).message}`);
      }
    }
    return stale.length;
  }
}
