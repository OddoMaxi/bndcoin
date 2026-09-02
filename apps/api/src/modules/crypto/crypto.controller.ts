import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { CurrentUser, Public, RequirePermission } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { PricingService } from '../pricing/pricing.service';
import { CryptoNetworksService } from './crypto-networks.service';
import { CryptoService } from './crypto.service';

class QuoteDto {
  @IsIn(['BUY_USDT', 'SELL_USDT']) side!: 'BUY_USDT' | 'SELL_USDT';
  @IsOptional() @Matches(/^\d+$/) gnfAmount?: string;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) usdtAmount?: string;
  @IsOptional() @IsString() networkId?: string;
  @IsOptional() @IsString() segment?: string;
}
class CreateBuyDto {
  @IsString() quoteId!: string;
  @IsString() networkId!: string;
  @Matches(/^(T[1-9A-HJ-NP-Za-km-z]{33}|0x[0-9a-fA-F]{40})$/) destinationAddress!: string;
}
class CreateSellDto {
  @IsString() quoteId!: string;
  @IsString() networkId!: string;
}
class AdminTransitionDto {
  @IsString() toStatus!: string;
  @IsString() reason!: string;
}

@ApiTags('crypto')
@Controller()
export class CryptoController {
  constructor(
    private readonly crypto: CryptoService,
    private readonly pricing: PricingService,
    private readonly networks: CryptoNetworksService,
  ) {}

  @Public()
  @Get('crypto/networks')
  publicNetworks() {
    return this.networks.listEnabled();
  }

  @Post('quotes')
  @Idempotent()
  async quote(@CurrentUser('id') userId: string, @Body() dto: QuoteDto) {
    const q = await this.pricing.quote({
      userId,
      side: dto.side,
      gnfAmount: dto.gnfAmount,
      usdtAmount: dto.usdtAmount,
      networkId: dto.networkId,
      segment: dto.segment,
    });
    return this.pricing.toDto(q);
  }

  @Get('quotes/:id')
  async getQuote(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.pricing.toDto(await this.pricing.getQuote(id, userId));
  }

  @Post('crypto/orders/buy')
  @Idempotent()
  async buy(@CurrentUser('id') userId: string, @Body() dto: CreateBuyDto, @Headers('idempotency-key') key?: string) {
    const order = await this.crypto.createBuyOrder(userId, dto.quoteId, dto.destinationAddress, dto.networkId, key);
    return this.crypto.getOrderDto(order.id, userId);
  }

  @Post('crypto/orders/sell')
  @Idempotent()
  async sell(@CurrentUser('id') userId: string, @Body() dto: CreateSellDto) {
    const order = await this.crypto.createSellOrder(userId, dto.quoteId, dto.networkId);
    return this.crypto.getOrderDto(order.id, userId);
  }

  @Get('crypto/orders')
  list(@CurrentUser('id') userId: string, @Query('page') page?: string) {
    return this.crypto.listForUser(userId, page ? Number(page) : 1);
  }

  @Get('crypto/orders/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.crypto.getOrderDto(id, userId);
  }

  // --- admin ---
  @RequirePermission('crypto.read')
  @Get('admin/crypto/orders')
  adminList(@Query('side') side?: string, @Query('status') status?: string, @Query('page') page?: string) {
    return this.crypto.adminList({ side, status, page: page ? Number(page) : 1 });
  }

  @RequirePermission('crypto.read')
  @Get('admin/crypto/orders/:id')
  adminGet(@Param('id') id: string) {
    return this.crypto.getOrderDto(id, undefined, true);
  }

  @RequirePermission('crypto.operate')
  @Post('admin/crypto/orders/:id/transition')
  transition(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: AdminTransitionDto) {
    return this.crypto.adminTransition(actorId, id, dto.toStatus as never, dto.reason);
  }

  @RequirePermission('crypto.read')
  @Get('admin/crypto/networks')
  adminNetworks() {
    return this.networks.listAll();
  }

  @RequirePermission('crypto.operate')
  @Post('admin/crypto/networks')
  createNetwork(@CurrentUser('id') actorId: string, @Body() dto: Record<string, unknown>) {
    return this.networks.upsert(actorId, undefined, dto);
  }

  @RequirePermission('crypto.operate')
  @Post('admin/crypto/networks/:id')
  updateNetwork(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.networks.upsert(actorId, id, dto);
  }
}
