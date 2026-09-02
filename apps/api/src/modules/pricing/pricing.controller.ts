import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { CurrentUser, Public, RequirePermission } from '../../common/rbac/decorators';
import { PricingService } from './pricing.service';

class UpdateConfigDto {
  @Matches(/^\d+(\.\d+)?$/) referenceRate!: string;
  @IsOptional() riskBufferBps?: number;
  @IsOptional() quoteTtlSeconds?: number;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) minGnfAmount?: string;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) maxGnfAmount?: string;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) minUsdtAmount?: string;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) maxUsdtAmount?: string;
}

class RuleDto {
  @IsOptional() @IsIn(['TIER', 'SEGMENT', 'PROMO', 'EMERGENCY']) kind?: string;
  @IsIn(['BUY_USDT', 'SELL_USDT']) side!: 'BUY_USDT' | 'SELL_USDT';
  @IsOptional() @IsString() minUsdt?: string;
  @IsOptional() @IsString() maxUsdt?: string;
  @IsOptional() @IsString() segment?: string;
  @IsOptional() @IsString() spreadAbs?: string;
  @IsOptional() @IsString() spreadPct?: string;
  @IsOptional() @IsString() feeFixedGnf?: string;
  @IsOptional() @IsString() feePct?: string;
  @IsOptional() priority?: number;
  @IsOptional() active?: boolean;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
}

@ApiTags('pricing')
@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Get('pricing/rates')
  rates() {
    return this.pricing.publicRates();
  }

  @RequirePermission('pricing.read')
  @Get('admin/pricing/config')
  config() {
    return this.pricing.getActiveConfig();
  }

  @RequirePermission('pricing.write')
  @Put('admin/pricing/config')
  updateConfig(@CurrentUser('id') actorId: string, @Body() dto: UpdateConfigDto) {
    return this.pricing.updateConfig(actorId, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('pricing.read')
  @Get('admin/pricing/rules')
  rules() {
    return this.pricing.listRules();
  }

  @RequirePermission('pricing.write')
  @Post('admin/pricing/rules')
  createRule(@CurrentUser('id') actorId: string, @Body() dto: RuleDto) {
    return this.pricing.upsertRule(actorId, undefined, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('pricing.write')
  @Put('admin/pricing/rules/:id')
  updateRule(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: RuleDto) {
    return this.pricing.upsertRule(actorId, id, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('pricing.write')
  @Delete('admin/pricing/rules/:id')
  deleteRule(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.pricing.deleteRule(actorId, id);
  }
}
