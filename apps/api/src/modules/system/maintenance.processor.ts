import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AppConfigService } from '../../common/config/app-config.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JOB, QUEUE } from '../../common/queue/queue.constants';
import { PricingService } from '../pricing/pricing.service';
import { TreasuryService } from '../treasury/treasury.service';
import { CryptoService } from '../crypto/crypto.service';
import { ModemManager } from '../orange/modem-manager.service';

@Injectable()
@Processor(QUEUE.MAINTENANCE)
export class MaintenanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(QUEUE.MAINTENANCE) private readonly queue: Queue,
    private readonly config: AppConfigService,
    private readonly alerts: AlertsService,
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly treasury: TreasuryService,
    private readonly crypto: CryptoService,
    private readonly modems: ModemManager,
  ) {
    super();
  }

  async onModuleInit() {
    if (process.env.DISABLE_SCHEDULERS === 'true') {
      this.logger.log('Schedulers disabled (DISABLE_SCHEDULERS=true)');
      return;
    }
    const every = this.config.flow.quoteSweepIntervalSeconds * 1000;
    const add = (name: string, ms: number) =>
      this.queue.add(name, {}, { repeat: { every: ms }, removeOnComplete: true, removeOnFail: 50 });
    await add(JOB.QUOTE_SWEEP, every);
    await add(JOB.ORDER_SWEEP, Math.max(every, 60_000));
    await add(JOB.CRYPTO_WATCH_SWEEP, 45_000);
    await add(JOB.TREASURY_RECONCILE, 300_000);
    await add(JOB.ALERT_SCAN, 120_000);
    await add(JOB.MODEM_HEALTHCHECK, 60_000);
    this.logger.log('Maintenance jobs scheduled');
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case JOB.QUOTE_SWEEP:
          await this.pricing.expireStale();
          break;
        case JOB.ORDER_SWEEP:
          await this.crypto.expireStaleOrders();
          break;
        case JOB.CRYPTO_WATCH_SWEEP:
          // Safety net: re-drives every active crypto order in case a per-order
          // delayed job died (worker restart, dropped Redis key, etc).
          await this.crypto.sweepActiveOrders();
          break;
        case JOB.TREASURY_RECONCILE:
          await this.treasury.reconcile();
          break;
        case JOB.MODEM_HEALTHCHECK:
          await this.modems.healthcheckAll();
          break;
        case JOB.ALERT_SCAN:
          await this.scanAlerts();
          break;
      }
    } catch (err) {
      this.logger.warn(`maintenance ${job.name}: ${(err as Error).message}`);
    }
  }

  private async scanAlerts() {
    const stuckPay = await this.prisma.paymentIntent.count({
      where: { status: { in: ['AWAITING_PAYMENT', 'PAYMENT_DETECTED'] }, createdAt: { lt: new Date(Date.now() - 3_600_000) } },
    });
    if (stuckPay > 0) {
      await this.alerts.raise('WARNING', 'PAYMENT_STUCK', `${stuckPay} payment(s) pending over an hour`);
    }
    const stuckPayout = await this.prisma.payout.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] }, createdAt: { lt: new Date(Date.now() - 1_800_000) } },
    });
    if (stuckPayout > 0) {
      await this.alerts.raise('HIGH', 'PAYOUT_STUCK', `${stuckPayout} payout(s) stuck over 30 min`);
    }
    const offline = await this.prisma.orangeModem.count({ where: { status: 'OFFLINE', enabled: true } });
    if (offline > 0) await this.alerts.raise('WARNING', 'MODEM_OFFLINE', `${offline} enabled modem(s) offline`);
  }
}
