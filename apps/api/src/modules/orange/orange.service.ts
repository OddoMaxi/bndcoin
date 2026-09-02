import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toMoneyString } from '../../common/util/decimal';

/** Read models for the Orange Money control centre. */
@Injectable()
export class OrangeService {
  constructor(private readonly prisma: PrismaService) {}

  async controlCentre() {
    const [modems, gateways, intents, payouts] = await Promise.all([
      this.prisma.orangeModem.findMany({ include: { sim: true }, orderBy: { name: 'asc' } }),
      this.prisma.orangeGateway.findMany(),
      this.prisma.paymentIntent.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payout.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      gateways,
      modems: modems.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        enabled: m.enabled,
        phoneNumber: m.phoneNumber,
        sim: m.sim ? { msisdn: m.sim.msisdn, status: m.sim.status } : null,
        balanceGnf: toMoneyString(m.balanceGnf, 'GNF'),
        dailyTxCount: m.dailyTxCount,
        dailyVolumeGnf: toMoneyString(m.dailyVolume, 'GNF'),
        dailyLimitGnf: toMoneyString(m.dailyLimit, 'GNF'),
        activeJobs: m.activeJobs,
        recentFailures: m.recentFailures,
        lastActivityAt: m.lastActivityAt?.toISOString() ?? null,
        lastHealthcheckAt: m.lastHealthcheckAt?.toISOString() ?? null,
        lastError: m.lastError,
      })),
      payments: Object.fromEntries(intents.map((i) => [i.status, i._count._all])),
      payouts: Object.fromEntries(payouts.map((p) => [p.status, p._count._all])),
    };
  }

  async listSessions(modemId?: string) {
    return this.prisma.orangeSession.findMany({
      where: modemId ? { modemId } : {},
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }
}
