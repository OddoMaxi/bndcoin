import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';

class ResolveDto {
  @IsIn(['VERIFY', 'REJECT']) decision!: 'VERIFY' | 'REJECT';
  @IsString() @MaxLength(300) reason!: string;
}

@ApiTags('reconciliation')
@RequirePermission('reconciliation.read')
@Controller('admin/reconciliation')
export class ReconciliationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  async list(@Query('status') status?: string) {
    const rows = await this.prisma.reconciliation.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { intent: true, payout: true },
    });
    return rows;
  }

  @Get('open')
  open() {
    return this.prisma.reconciliation.findMany({
      where: { status: { in: ['OPEN', 'MISMATCH', 'MANUAL_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      include: { intent: true, payout: true },
    });
  }

  @RequirePermission('reconciliation.resolve')
  @Post('payment/:intentId/resolve')
  resolvePayment(
    @CurrentUser('id') actorId: string,
    @Param('intentId') intentId: string,
    @Body() dto: ResolveDto,
  ) {
    return this.payments.adminResolve(actorId, intentId, dto.decision, dto.reason);
  }
}
