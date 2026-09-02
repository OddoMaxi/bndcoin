import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/rbac/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { TreasuryService } from '../treasury/treasury.service';
import { InventoryService } from '../suppliers/inventory.service';
import { toMoneyString } from '../../common/util/decimal';

@ApiTags('admin')
@RequirePermission('system.health')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly alerts: AlertsService,
    private readonly treasury: TreasuryService,
    private readonly inventory: InventoryService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [
      users,
      kycPending,
      balances,
      inventory,
      cryptoByStatus,
      cryptoToday,
      pendingPayments,
      pendingPayouts,
      failedTx,
      events,
      ticketsSold,
      checkins,
      settlementsDue,
      ledgerIntegrity,
      openAlerts,
      platformRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.kycRecord.count({ where: { status: 'PENDING' } }),
      this.treasury.getBalances(),
      this.inventory.inventorySummary(),
      this.prisma.cryptoOrder.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.cryptoOrder.aggregate({
        where: { createdAt: { gte: dayStart } },
        _count: { _all: true },
        _sum: { gnfAmount: true },
      }),
      this.prisma.paymentIntent.count({ where: { status: { in: ['AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'UNDER_REVIEW'] } } }),
      this.prisma.payout.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'UNDER_REVIEW'] } } }),
      this.prisma.cryptoOrder.count({ where: { status: { in: ['FAILED', 'UNDER_REVIEW'] } } }),
      this.prisma.event.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.ticket.count(),
      this.prisma.checkin.count({ where: { result: 'VALID' } }),
      this.prisma.settlement.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
      this.ledger.integrityCheck(),
      this.prisma.alert.count({ where: { status: 'OPEN' } }),
      this.ledger.balance('PLATFORM_REVENUE').catch(() => '0'),
    ]);

    const buyOrders = cryptoByStatus.filter((c) => c.status === 'COMPLETED');
    return {
      users: { total: users, kycPending },
      treasury: {
        gnf: balances['GNF'],
        usdt: balances['USDT'],
        inventory,
      },
      crypto: {
        byStatus: Object.fromEntries(cryptoByStatus.map((c) => [c.status, c._count._all])),
        today: { count: cryptoToday._count._all, volumeGnf: toMoneyString(cryptoToday._sum.gnfAmount ?? 0, 'GNF') },
        completed: buyOrders.reduce((s, b) => s + b._count._all, 0),
      },
      operations: { pendingPayments, pendingPayouts, failedTransactions: failedTx },
      events: { active: events, ticketsSold, checkins, settlementsDue },
      finance: { platformRevenueGnf: platformRevenue, ledgerBalanced: ledgerIntegrity.ok },
      alerts: { open: openAlerts },
    };
  }

  @RequirePermission('alerts.read')
  @Get('alerts')
  listAlerts() {
    return this.alerts.list('OPEN');
  }
}
