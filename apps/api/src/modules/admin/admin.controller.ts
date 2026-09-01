import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/rbac/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TreasuryService } from '../treasury/treasury.service';

@ApiTags('admin')
@Roles('ADMIN', 'TREASURY_OPS', 'COMPLIANCE')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treasury: TreasuryService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [byStatus, balances, reservations, users, todaysCount] = await Promise.all([
      this.prisma.transaction.groupBy({ by: ['status'], _count: { _all: true } }),
      this.treasury.getBalances(),
      this.treasury.openReservationsSummary(),
      this.prisma.user.count(),
      this.prisma.transaction.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return {
      transactionsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      transactionsToday: todaysCount,
      manualReviewOpen: byStatus.find((r) => r.status === 'MANUAL_REVIEW')?._count._all ?? 0,
      treasury: { balances, reservations },
      users,
    };
  }
}
