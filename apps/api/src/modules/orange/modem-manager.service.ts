import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModemStatus, OrangeModem } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { DomainError } from '../../common/errors/domain-errors';
import { ORANGE_PROVIDER, OrangeMoneyProvider } from './orange-provider.interface';

const ALLOCATABLE: ModemStatus[] = ['ONLINE', 'AVAILABLE'];
const MAX_RECENT_FAILURES = 3;

/**
 * Allocates a modem per payment/payout using availability, float headroom,
 * daily-limit headroom, current workload and recent failure rate — never plain
 * round-robin. Scales to N modems without touching business logic.
 */
@Injectable()
export class ModemManager {
  private readonly logger = new Logger(ModemManager.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
    @Inject(ORANGE_PROVIDER) private readonly provider: OrangeMoneyProvider,
  ) {}

  private score(m: OrangeModem, amount: Money): number {
    const balHeadroom = Number(Money.of(m.balanceGnf.toFixed(), 'GNF').sub(amount).toPreciseString());
    const dailyHeadroom =
      Number(m.dailyLimit.toFixed()) <= 0
        ? 1e12
        : Number(m.dailyLimit.toFixed()) - Number(m.dailyVolume.toFixed()) - Number(amount.toPreciseString());
    return (
      (m.status === 'ONLINE' ? 1000 : 0) +
      Math.min(balHeadroom / 1000, 5000) +
      Math.min(dailyHeadroom / 1000, 5000) -
      m.activeJobs * 800 -
      m.recentFailures * 2500
    );
  }

  /** Pick + reserve a modem inside the caller transaction. Returns the modem id. */
  async allocate(tx: Tx, amountGnf: string, direction: 'COLLECT' | 'PAYOUT'): Promise<string> {
    await tx.$executeRawUnsafe('SELECT 1 FROM "OrangeModem" FOR UPDATE');
    const modems = await tx.orangeModem.findMany({ where: { enabled: true, status: { in: ALLOCATABLE } } });
    const amount = Money.of(amountGnf, 'GNF');

    const eligible = modems.filter((m) => {
      if (m.recentFailures >= MAX_RECENT_FAILURES) return false;
      const bal = Money.of(m.balanceGnf.toFixed(), 'GNF');
      if (direction === 'PAYOUT' && bal.lt(amount)) return false;
      const dailyLimit = Number(m.dailyLimit.toFixed());
      if (dailyLimit > 0 && Number(m.dailyVolume.toFixed()) + Number(amount.toPreciseString()) > dailyLimit) {
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      await this.alerts.raise('HIGH', 'MODEM_OFFLINE', `No eligible modem for a ${direction} of ${amountGnf} GNF`);
      throw new DomainError('NO_MODEM_AVAILABLE', 'No Orange Money modem is available to process this', 503);
    }

    const best = eligible.sort((a, b) => this.score(b, amount) - this.score(a, amount))[0];
    await tx.orangeModem.update({
      where: { id: best.id },
      data: { activeJobs: { increment: 1 }, status: 'BUSY', lastActivityAt: new Date() },
    });
    this.logger.log(`Allocated modem ${best.name} for ${direction} ${amountGnf} GNF`);
    return best.id;
  }

  async release(modemId: string, result: { success: boolean; volumeGnf?: string }): Promise<void> {
    const modem = await this.prisma.orangeModem.findUnique({ where: { id: modemId } });
    if (!modem) return;
    const data: Record<string, unknown> = {
      activeJobs: { decrement: Math.min(modem.activeJobs, 1) },
      lastActivityAt: new Date(),
      status: modem.activeJobs <= 1 ? 'ONLINE' : 'BUSY',
    };
    if (result.success) {
      data.recentFailures = 0;
      data.dailyTxCount = { increment: 1 };
      if (result.volumeGnf) data.dailyVolume = { increment: result.volumeGnf };
    } else {
      data.recentFailures = { increment: 1 };
      data.errorCount = { increment: 1 };
      if (modem.recentFailures + 1 >= MAX_RECENT_FAILURES) {
        data.status = 'MAINTENANCE';
        data.enabled = false;
        await this.alerts.raise('HIGH', 'MODEM_OFFLINE', `Modem ${modem.name} auto-disabled after repeated failures`);
      }
    }
    await this.prisma.orangeModem.update({ where: { id: modemId }, data });
  }

  async healthcheckAll(): Promise<void> {
    const modems = await this.prisma.orangeModem.findMany();
    for (const m of modems) {
      try {
        const h = await this.provider.modemHealth(m.id);
        await this.prisma.orangeModem.update({
          where: { id: m.id },
          data: {
            lastHealthcheckAt: new Date(),
            balanceGnf: h.balanceGnf ?? m.balanceGnf,
            status:
              m.status === 'MAINTENANCE'
                ? 'MAINTENANCE'
                : h.online
                  ? m.activeJobs > 0
                    ? 'BUSY'
                    : 'ONLINE'
                  : 'OFFLINE',
          },
        });
        if (!h.online && m.status !== 'MAINTENANCE') {
          await this.alerts.raise('WARNING', 'MODEM_OFFLINE', `Modem ${m.name} is offline`);
        }
      } catch (err) {
        await this.prisma.orangeModem.update({
          where: { id: m.id },
          data: { status: 'USSD_ERROR', lastError: (err as Error).message, lastHealthcheckAt: new Date() },
        });
      }
    }
  }

  async setModemState(actorId: string, id: string, action: 'ENABLE' | 'DISABLE' | 'MAINTENANCE') {
    const data =
      action === 'ENABLE'
        ? { enabled: true, status: 'ONLINE' as ModemStatus }
        : action === 'DISABLE'
          ? { enabled: false, status: 'OFFLINE' as ModemStatus }
          : { enabled: false, status: 'MAINTENANCE' as ModemStatus };
    const modem = await this.prisma.orangeModem.update({ where: { id }, data });
    await this.audit.recordStandalone({
      action: `orange.modem_${action.toLowerCase()}`,
      entityType: 'OrangeModem',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
      after: { action },
    });
    return modem;
  }
}
