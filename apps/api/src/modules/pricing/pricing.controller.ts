import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '../../common/rbac/decorators';
import { UpdatePricingDto } from './dto';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Get('pricing/current')
  current() {
    return this.pricing.getCurrent('GNF_USDT');
  }

  @Roles('ADMIN', 'TREASURY_OPS')
  @Get('admin/pricing/history')
  history() {
    return this.pricing.history('GNF_USDT');
  }

  @Roles('ADMIN', 'TREASURY_OPS')
  @Put('admin/pricing')
  update(@CurrentUser('id') actorId: string, @Body() dto: UpdatePricingDto) {
    return this.pricing.updateConfig(actorId, dto, 'GNF_USDT');
  }
}
