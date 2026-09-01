import { Injectable } from '@nestjs/common';
import { PricingConfig, TradingPair } from '@prisma/client';
import { computeBuyRate, Money } from '@bn/money';
import { PricingDto } from '@bn/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { toMoneyString, decimalToString } from '../../common/util/decimal';
import { UpdatePricingDto } from './dto';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActiveConfig(pair: TradingPair = 'GNF_USDT'): Promise<PricingConfig> {
    const config = await this.prisma.pricingConfig.findFirst({
      where: { pair, active: true },
      orderBy: { version: 'desc' },
    });
    if (!config) throw new NotFoundError('Active pricing config for pair', pair);
    return config;
  }

  toDto(config: PricingConfig): PricingDto {
    const marketRate = decimalToString(config.marketRate);
    return {
      pair: config.pair,
      marketRate,
      buyRate: computeBuyRate(marketRate, config.buySpreadBps),
      buySpreadBps: config.buySpreadBps,
      feeGnfFlat: toMoneyString(config.feeGnfFlat, 'GNF'),
      minGnfAmount: toMoneyString(config.minGnfAmount, 'GNF'),
      maxGnfAmount: toMoneyString(config.maxGnfAmount, 'GNF'),
      quoteTtlSeconds: config.quoteTtlSeconds,
      version: config.version,
    };
  }

  async getCurrent(pair: TradingPair = 'GNF_USDT'): Promise<PricingDto> {
    return this.toDto(await this.getActiveConfig(pair));
  }

  async history(pair: TradingPair = 'GNF_USDT') {
    const rows = await this.prisma.pricingConfig.findMany({
      where: { pair },
      orderBy: { version: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      ...this.toDto(r),
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
    }));
  }

  async updateConfig(actorId: string, dto: UpdatePricingDto, pair: TradingPair = 'GNF_USDT') {
    const min = Money.of(dto.minGnfAmount, 'GNF').assertPositive('minGnfAmount');
    if (Money.of(dto.maxGnfAmount, 'GNF').lt(min)) {
      throw new ValidationError('maxGnfAmount must be greater than or equal to minGnfAmount');
    }

    return this.prisma.runInTransaction(async (tx) => {
      const current = await tx.pricingConfig.findFirst({
        where: { pair },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (current?.version ?? 0) + 1;

      await tx.pricingConfig.updateMany({ where: { pair, active: true }, data: { active: false } });

      const created = await tx.pricingConfig.create({
        data: {
          pair,
          marketRate: dto.marketRate,
          buySpreadBps: dto.buySpreadBps,
          sellSpreadBps: dto.sellSpreadBps ?? dto.buySpreadBps,
          feeGnfFlat: dto.feeGnfFlat ?? '0',
          minGnfAmount: dto.minGnfAmount,
          maxGnfAmount: dto.maxGnfAmount,
          quoteTtlSeconds: dto.quoteTtlSeconds,
          version: nextVersion,
          active: true,
          createdBy: actorId,
        },
      });

      await this.audit.record(tx, {
        action: 'pricing.updated',
        entityType: 'PricingConfig',
        entityId: created.id,
        actorType: 'ADMIN',
        actorId,
        before: current
          ? { version: current.version, marketRate: decimalToString(current.marketRate) }
          : null,
        after: { version: nextVersion, marketRate: dto.marketRate, buySpreadBps: dto.buySpreadBps },
      });

      return this.toDto(created);
    });
  }
}
