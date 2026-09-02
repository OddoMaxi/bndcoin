import { Injectable } from '@nestjs/common';
import { PriceQuote, PricingConfig, PricingRule, QuoteSide } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  QuoteExpiredError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { quotePublicId } from '../../common/util/public-id';
import { toMoneyString, decimalToString } from '../../common/util/decimal';
import { computePrice, RuleParams } from './pricing.math';

export interface QuoteRequest {
  userId: string;
  side: QuoteSide;
  gnfAmount?: string;
  usdtAmount?: string;
  segment?: string;
  networkId?: string;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  async getActiveConfig(): Promise<PricingConfig> {
    const cfg = await this.prisma.pricingConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } });
    if (!cfg) throw new NotFoundError('Active pricing config');
    return cfg;
  }

  private defaultRule(side: QuoteSide): RuleParams {
    const bps = side === 'BUY_USDT' ? this.config.pricing.buySpreadBps : this.config.pricing.sellSpreadBps;
    return {
      spreadAbs: '0',
      spreadPct: (bps / 10_000).toString(),
      feeFixedGnf: '0',
      feePct: '0',
    };
  }

  private ruleToParams(rule: PricingRule): RuleParams {
    return {
      spreadAbs: decimalToString(rule.spreadAbs),
      spreadPct: decimalToString(rule.spreadPct),
      feeFixedGnf: decimalToString(rule.feeFixedGnf),
      feePct: decimalToString(rule.feePct),
    };
  }

  private async pickRule(side: QuoteSide, usdtVolume: string, segment?: string): Promise<PricingRule | null> {
    const now = new Date();
    const vol = Money.of(usdtVolume, 'USDT');
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        side,
        active: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          { OR: [{ segment: null }, ...(segment ? [{ segment }] : [])] },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    for (const r of rules) {
      const min = Money.of(decimalToString(r.minUsdt), 'USDT');
      const max = r.maxUsdt ? Money.of(decimalToString(r.maxUsdt), 'USDT') : null;
      if (vol.gte(min) && (!max || vol.lte(max))) return r;
    }
    return null;
  }

  async quote(req: QuoteRequest): Promise<PriceQuote> {
    if (!req.gnfAmount && !req.usdtAmount) {
      throw new ValidationError('Provide either gnfAmount or usdtAmount');
    }
    const cfg = await this.getActiveConfig();
    const referenceRate = decimalToString(cfg.referenceRate);

    // amount bounds
    if (req.gnfAmount) {
      const g = Money.of(req.gnfAmount, 'GNF');
      if (g.lt(Money.of(decimalToString(cfg.minGnfAmount), 'GNF')) || g.gt(Money.of(decimalToString(cfg.maxGnfAmount), 'GNF'))) {
        throw new ValidationError('GNF amount is outside the allowed range');
      }
    }
    if (req.usdtAmount) {
      const u = Money.of(req.usdtAmount, 'USDT');
      if (u.lt(Money.of(decimalToString(cfg.minUsdtAmount), 'USDT')) || u.gt(Money.of(decimalToString(cfg.maxUsdtAmount), 'USDT'))) {
        throw new ValidationError('USDT amount is outside the allowed range');
      }
    }

    // provisional pass with default rule to establish volume tier
    const provisional = computePrice({
      side: req.side,
      referenceRate,
      riskBufferBps: cfg.riskBufferBps,
      rule: this.defaultRule(req.side),
      gnfAmount: req.gnfAmount,
      usdtAmount: req.usdtAmount,
    });

    const rule = await this.pickRule(req.side, provisional.usdtAmount, req.segment);
    const finalCalc = computePrice({
      side: req.side,
      referenceRate,
      riskBufferBps: cfg.riskBufferBps,
      rule: rule ? this.ruleToParams(rule) : this.defaultRule(req.side),
      gnfAmount: req.gnfAmount,
      usdtAmount: req.usdtAmount,
    });

    if (Money.of(finalCalc.usdtAmount, 'USDT').isZero()) {
      throw new ValidationError('Amount too small to produce a quote');
    }

    const created = await this.prisma.priceQuote.create({
      data: {
        publicId: quotePublicId(),
        userId: req.userId,
        side: req.side,
        status: 'ACTIVE',
        referenceRate,
        spread: finalCalc.spread,
        fees: finalCalc.feesGnf,
        finalRate: finalCalc.finalRate,
        gnfAmount: finalCalc.gnfAmount,
        usdtAmount: finalCalc.usdtAmount,
        networkId: req.networkId,
        segment: req.segment,
        pricingVersion: cfg.version,
        expiresAt: new Date(Date.now() + cfg.quoteTtlSeconds * 1000),
      },
    });
    await this.audit.recordStandalone({
      action: 'quote.created',
      entityType: 'PriceQuote',
      entityId: created.id,
      actorId: req.userId,
      after: { side: req.side, gnfAmount: finalCalc.gnfAmount, usdtAmount: finalCalc.usdtAmount, finalRate: finalCalc.finalRate },
    });
    return created;
  }

  toDto(q: PriceQuote) {
    const expiresInSeconds = Math.max(0, Math.floor((q.expiresAt.getTime() - Date.now()) / 1000));
    return {
      id: q.id,
      publicId: q.publicId,
      side: q.side,
      status: q.status,
      referenceRate: decimalToString(q.referenceRate),
      spread: decimalToString(q.spread),
      finalRate: decimalToString(q.finalRate),
      feesGnf: toMoneyString(q.fees, 'GNF'),
      gnfAmount: toMoneyString(q.gnfAmount, 'GNF'),
      usdtAmount: toMoneyString(q.usdtAmount, 'USDT'),
      networkId: q.networkId,
      expiresAt: q.expiresAt.toISOString(),
      expiresInSeconds,
      createdAt: q.createdAt.toISOString(),
    };
  }

  async getQuote(id: string, userId: string): Promise<PriceQuote> {
    const q = await this.prisma.priceQuote.findUnique({ where: { id } });
    if (!q) throw new NotFoundError('PriceQuote', id);
    if (q.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
    if (q.status === 'ACTIVE' && q.expiresAt < new Date()) {
      return this.prisma.priceQuote.update({ where: { id }, data: { status: 'EXPIRED' } });
    }
    return q;
  }

  async lockForOrder(tx: Tx, id: string, userId: string): Promise<PriceQuote> {
    await tx.$executeRawUnsafe('SELECT 1 FROM "PriceQuote" WHERE "id" = $1 FOR UPDATE', id);
    const q = await tx.priceQuote.findUnique({ where: { id } });
    if (!q) throw new NotFoundError('PriceQuote', id);
    if (q.userId !== userId) throw new ForbiddenError('This quote belongs to another user');
    if (q.status === 'LOCKED') return q;
    if (q.status !== 'ACTIVE' || q.expiresAt < new Date()) {
      if (q.status === 'ACTIVE') await tx.priceQuote.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new QuoteExpiredError();
    }
    return tx.priceQuote.update({ where: { id }, data: { status: 'LOCKED', lockedAt: new Date() } });
  }

  async markConsumed(tx: Tx, id: string) {
    await tx.priceQuote.update({ where: { id }, data: { status: 'CONSUMED' } });
  }

  async expireStale(): Promise<number> {
    const res = await this.prisma.priceQuote.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return res.count;
  }

  /** Indicative buy/sell rates for the home screen (nominal 100 USDT). */
  async publicRates() {
    const cfg = await this.getActiveConfig();
    const ref = decimalToString(cfg.referenceRate);
    const out: Record<string, unknown> = { referenceRate: ref, pair: 'GNF/USDT' };
    for (const side of ['BUY_USDT', 'SELL_USDT'] as QuoteSide[]) {
      const rule = await this.pickRule(side, '100');
      const calc = computePrice({
        side,
        referenceRate: ref,
        riskBufferBps: cfg.riskBufferBps,
        rule: rule ? this.ruleToParams(rule) : this.defaultRule(side),
        usdtAmount: '100',
      });
      out[side === 'BUY_USDT' ? 'buyRate' : 'sellRate'] = calc.finalRate;
    }
    out['minGnfAmount'] = toMoneyString(cfg.minGnfAmount, 'GNF');
    out['maxGnfAmount'] = toMoneyString(cfg.maxGnfAmount, 'GNF');
    out['quoteTtlSeconds'] = cfg.quoteTtlSeconds;
    return out;
  }

  // ---- admin ----
  async updateConfig(actorId: string, dto: Record<string, unknown>) {
    return this.prisma.runInTransaction(async (tx) => {
      const current = await tx.pricingConfig.findFirst({ orderBy: { version: 'desc' } });
      const nextVersion = (current?.version ?? 0) + 1;
      await tx.pricingConfig.updateMany({ where: { active: true }, data: { active: false } });
      const created = await tx.pricingConfig.create({
        data: {
          referenceRate: dto.referenceRate as string,
          riskBufferBps: (dto.riskBufferBps as number) ?? 0,
          quoteTtlSeconds: (dto.quoteTtlSeconds as number) ?? this.config.pricing.quoteTtl,
          minGnfAmount: (dto.minGnfAmount as string) ?? current?.minGnfAmount.toFixed() ?? '50000',
          maxGnfAmount: (dto.maxGnfAmount as string) ?? current?.maxGnfAmount.toFixed() ?? '50000000',
          minUsdtAmount: (dto.minUsdtAmount as string) ?? current?.minUsdtAmount.toFixed() ?? '5',
          maxUsdtAmount: (dto.maxUsdtAmount as string) ?? current?.maxUsdtAmount.toFixed() ?? '10000',
          version: nextVersion,
          active: true,
          createdBy: actorId,
        },
      });
      await this.audit.record(tx, {
        action: 'pricing.config_updated',
        entityType: 'PricingConfig',
        entityId: created.id,
        actorType: 'ADMIN',
        actorId,
        before: current ? { version: current.version, referenceRate: decimalToString(current.referenceRate) } : null,
        after: { version: nextVersion, referenceRate: dto.referenceRate },
      });
      return created;
    });
  }

  listRules() {
    return this.prisma.pricingRule.findMany({ orderBy: [{ side: 'asc' }, { priority: 'desc' }] });
  }

  async upsertRule(actorId: string, id: string | undefined, dto: Record<string, unknown>) {
    const data = {
      kind: (dto.kind as string) ?? 'TIER',
      side: dto.side as QuoteSide,
      minUsdt: (dto.minUsdt as string) ?? '0',
      maxUsdt: (dto.maxUsdt as string) ?? null,
      segment: (dto.segment as string) ?? null,
      spreadAbs: (dto.spreadAbs as string) ?? '0',
      spreadPct: (dto.spreadPct as string) ?? '0',
      feeFixedGnf: (dto.feeFixedGnf as string) ?? '0',
      feePct: (dto.feePct as string) ?? '0',
      priority: (dto.priority as number) ?? 100,
      active: dto.active === undefined ? true : Boolean(dto.active),
      validFrom: dto.validFrom ? new Date(dto.validFrom as string) : null,
      validTo: dto.validTo ? new Date(dto.validTo as string) : null,
      createdBy: actorId,
    };
    const rule = id
      ? await this.prisma.pricingRule.update({ where: { id }, data: data as never })
      : await this.prisma.pricingRule.create({ data: data as never });
    await this.audit.recordStandalone({
      action: id ? 'pricing.rule_updated' : 'pricing.rule_created',
      entityType: 'PricingRule',
      entityId: rule.id,
      actorType: 'ADMIN',
      actorId,
      after: data,
    });
    return rule;
  }

  async deleteRule(actorId: string, id: string) {
    await this.prisma.pricingRule.update({ where: { id }, data: { active: false } });
    await this.audit.recordStandalone({
      action: 'pricing.rule_disabled',
      entityType: 'PricingRule',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
    });
    return { ok: true };
  }
}
