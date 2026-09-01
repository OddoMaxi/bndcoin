import { Injectable, Logger } from '@nestjs/common';
import { Quote } from '@prisma/client';
import { assertGnfWithinRange, computeBuyQuote, Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  ForbiddenError,
  NotFoundError,
  QuoteExpiredError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { quotePublicId } from '../../common/util/public-id';
import { decimalToString } from '../../common/util/decimal';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from './dto';
import { toQuoteDto } from './quote.mapper';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateQuoteDto) {
    const config = await this.pricing.getActiveConfig('GNF_USDT');

    const marketRate = decimalToString(config.marketRate);
    const minGnf = decimalToString(config.minGnfAmount);
    const maxGnf = decimalToString(config.maxGnfAmount);

    try {
      assertGnfWithinRange(dto.gnfAmount, { min: minGnf, max: maxGnf });
    } catch (err) {
      throw new ValidationError((err as Error).message);
    }

    await this.assertWithinUserLimits(userId, dto.gnfAmount);

    const computed = computeBuyQuote({
      gnfAmount: dto.gnfAmount,
      marketRate,
      buySpreadBps: config.buySpreadBps,
      feeGnfFlat: decimalToString(config.feeGnfFlat),
    });

    if (Money.of(computed.usdtAmount, 'USDT').isZero()) {
      throw new ValidationError('Amount too small to convert to USDT');
    }

    const expiresAt = new Date(Date.now() + config.quoteTtlSeconds * 1000);
    const quote = await this.prisma.quote.create({
      data: {
        publicId: quotePublicId(),
        userId,
        pair: 'GNF_USDT',
        side: 'BUY',
        status: 'PENDING',
        marketRate: computed.marketRate,
        bnRate: computed.bnRate,
        spreadBps: computed.spreadBps,
        feeGnf: computed.feeGnf,
        gnfAmount: computed.gnfAmount,
        usdtAmount: computed.usdtAmount,
        pricingConfigVersion: config.version,
        expiresAt,
      },
    });

    // Fast-path expiry mirror (advisory; DB expiresAt is authoritative).
    await this.redis.client.set(`quote:exp:${quote.id}`, '1', 'EX', config.quoteTtlSeconds);

    await this.audit.recordStandalone({
      action: 'quote.created',
      entityType: 'Quote',
      entityId: quote.id,
      actorId: userId,
      after: { gnfAmount: computed.gnfAmount, usdtAmount: computed.usdtAmount, bnRate: computed.bnRate },
    });

    return toQuoteDto(quote);
  }

  private async assertWithinUserLimits(userId: string, gnfAmount: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const limit =
      (await this.prisma.transactionLimit.findFirst({
        where: { scope: 'KYC_LEVEL', refId: user.kycLevel, currency: 'GNF', active: true },
      })) ??
      (await this.prisma.transactionLimit.findFirst({
        where: { scope: 'GLOBAL', currency: 'GNF', active: true },
      }));
    if (!limit) return;

    const amount = Money.of(gnfAmount, 'GNF');
    if (amount.lt(Money.of(decimalToString(limit.perTxMin), 'GNF'))) {
      throw new ValidationError(`Amount is below your per-transaction minimum`);
    }
    if (amount.gt(Money.of(decimalToString(limit.perTxMax), 'GNF'))) {
      throw new ValidationError(
        `Amount exceeds your per-transaction limit for KYC level ${user.kycLevel}`,
      );
    }
  }

  async getById(id: string, requesterId?: string, isAdmin = false): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundError('Quote', id);
    if (!isAdmin && requesterId && quote.userId !== requesterId) {
      throw new ForbiddenError('This quote belongs to another user');
    }
    if (quote.status === 'PENDING' && quote.expiresAt < new Date()) {
      return this.expireOne(id);
    }
    return quote;
  }

  async getDto(id: string, requesterId?: string, isAdmin = false) {
    return toQuoteDto(await this.getById(id, requesterId, isAdmin));
  }

  private async expireOne(id: string): Promise<Quote> {
    const quote = await this.prisma.quote.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    await this.audit.recordStandalone({
      action: 'quote.expired',
      entityType: 'Quote',
      entityId: id,
      actorType: 'SYSTEM',
    });
    return quote;
  }

  /** Bulk-expire stale PENDING quotes. Invoked by the sweep job. */
  async expireStale(): Promise<number> {
    const stale = await this.prisma.quote.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true },
      take: 500,
    });
    if (stale.length === 0) return 0;
    await this.prisma.quote.updateMany({
      where: { id: { in: stale.map((q) => q.id) } },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(`Swept ${stale.length} expired quote(s)`);
    return stale.length;
  }

  /** Loads + row-locks a quote for acceptance inside an existing transaction. */
  async lockForAccept(tx: Tx, quoteId: string, userId: string): Promise<Quote> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Quote" WHERE "id" = ${quoteId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundError('Quote', quoteId);

    const quote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId } });
    if (quote.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
    if (quote.status === 'ACCEPTED' && quote.transactionId) {
      // caller handles idempotent replay
      return quote;
    }
    if (quote.status !== 'PENDING') {
      throw new QuoteExpiredError();
    }
    if (quote.expiresAt < new Date()) {
      await tx.quote.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } });
      throw new QuoteExpiredError();
    }
    return quote;
  }

  async markAccepted(tx: Tx, quoteId: string, transactionId: string): Promise<void> {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), transactionId },
    });
  }

  async listForUser(userId: string) {
    const quotes = await this.prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return quotes.map(toQuoteDto);
  }

  async adminList(status?: string) {
    const quotes = await this.prisma.quote.findMany({
      where: status ? { status: status as Quote['status'] } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return quotes.map(toQuoteDto);
  }
}
