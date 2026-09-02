import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

class ResolvePaymentDto {
  @IsIn(['VERIFY', 'REJECT']) decision!: 'VERIFY' | 'REJECT';
  @IsString() @MaxLength(300) reason!: string;
}

@ApiTags('payments')
@Controller('admin')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
  ) {}

  @RequirePermission('payments.read')
  @Get('payments')
  listPayments(@Query('status') status?: string, @Query('page') page?: string) {
    return this.payments.list(status, page ? Number(page) : 1);
  }

  @RequirePermission('payments.read')
  @Get('payments/:id')
  paymentDetail(@Param('id') id: string) {
    return this.payments.detail(id);
  }

  @RequirePermission('payments.operate')
  @Post('payments/:id/resolve')
  resolve(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: ResolvePaymentDto) {
    return this.payments.adminResolve(actorId, id, dto.decision, dto.reason);
  }

  @RequirePermission('payouts.read')
  @Get('payouts')
  listPayouts(@Query('status') status?: string, @Query('page') page?: string) {
    return this.payouts.list(status, page ? Number(page) : 1);
  }

  @RequirePermission('payouts.operate')
  @Post('payouts/:id/retry')
  retryPayout(@Param('id') id: string) {
    return this.payouts.process(id);
  }
}
