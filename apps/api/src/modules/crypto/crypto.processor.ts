import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { JOB, QUEUE } from '../../common/queue/queue.constants';
import { CryptoService } from './crypto.service';

const MAX_ATTEMPTS = 20;

@Injectable()
@Processor(QUEUE.CRYPTO)
export class CryptoProcessor extends WorkerHost {
  private readonly logger = new Logger(CryptoProcessor.name);

  constructor(
    private readonly crypto: CryptoService,
    @InjectQueue(QUEUE.CRYPTO) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      const { orderId, attempt = 1 } = job.data as { orderId: string; attempt?: number };
      switch (job.name) {
        case JOB.BUY_PAYMENT_TIMEOUT:
          await this.crypto.expireBuy(orderId);
          break;
        case JOB.SELL_DEPOSIT_TIMEOUT:
          await this.crypto.expireSell(orderId);
          break;
        case JOB.SELL_WATCH_DEPOSIT: {
          const o = await this.crypto.driveSell(orderId);
          if (['AWAITING_CRYPTO', 'CRYPTO_DETECTED', 'CONFIRMING'].includes(o.status)) {
            if (attempt < MAX_ATTEMPTS) {
              await this.queue.add(
                JOB.SELL_WATCH_DEPOSIT,
                { orderId, attempt: attempt + 1 },
                { jobId: `sell-watch-${orderId}-${attempt + 1}`, delay: Math.min(15_000, 3_000 * attempt) },
              );
            } else {
              await this.crypto.flagForReview(orderId, `No USDT deposit detected after ${MAX_ATTEMPTS} checks`);
            }
          }
          break;
        }
        case JOB.WITHDRAWAL_CONFIRM: {
          const o = await this.crypto.driveBuy(orderId);
          if (o.status === 'USDT_SENT') {
            if (attempt < MAX_ATTEMPTS) {
              await this.queue.add(
                JOB.WITHDRAWAL_CONFIRM,
                { orderId, attempt: attempt + 1 },
                { jobId: `wd-${orderId}-${attempt + 1}`, delay: Math.min(30_000, 3_000 * attempt) },
              );
            } else {
              await this.crypto.flagForReview(orderId, `USDT not confirmed on-chain after ${MAX_ATTEMPTS} checks`);
            }
          }
          break;
        }
        default:
          this.logger.warn(`unknown crypto job ${job.name}`);
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') return;
      throw err;
    }
  }
}
