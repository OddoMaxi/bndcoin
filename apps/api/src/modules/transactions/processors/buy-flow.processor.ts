import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  BUY_FLOW_JOB,
  ConfirmUsdtJob,
  PaymentTimeoutJob,
  QUEUE,
} from '../../../common/queue/queue.constants';
import { AppConfigService } from '../../../common/config/app-config.service';
import { BuyFlowService } from '../buy-flow.service';

const MAX_CONFIRM_ATTEMPTS = 15;

@Injectable()
@Processor(QUEUE.BUY_FLOW)
export class BuyFlowProcessor extends WorkerHost {
  private readonly logger = new Logger(BuyFlowProcessor.name);

  constructor(
    private readonly buyFlow: BuyFlowService,
    private readonly config: AppConfigService,
    @InjectQueue(QUEUE.BUY_FLOW) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case BUY_FLOW_JOB.PAYMENT_TIMEOUT:
          return await this.handleTimeout(job.data as PaymentTimeoutJob);
        case BUY_FLOW_JOB.CONFIRM_USDT:
          return await this.handleConfirm(job.data as ConfirmUsdtJob);
        default:
          this.logger.warn(`Unknown buy-flow job: ${job.name}`);
      }
    } catch (err) {
      // A transaction removed between scheduling and running (e.g. test teardown)
      // should not spam retries.
      if ((err as { code?: string }).code === 'P2025') return;
      throw err;
    }
  }

  private async handleTimeout(data: PaymentTimeoutJob): Promise<void> {
    await this.buyFlow.expirePayment(data.transactionId);
  }

  private async handleConfirm(data: ConfirmUsdtJob): Promise<void> {
    const tx = await this.buyFlow.confirmUsdt(data.transactionId);
    if (tx.status === 'USDT_SENT') {
      if (data.attempt >= MAX_CONFIRM_ATTEMPTS) {
        await this.buyFlow.toManualReview(
          data.transactionId,
          `USDT not confirmed after ${MAX_CONFIRM_ATTEMPTS} checks`,
        );
        return;
      }
      await this.queue.add(
        BUY_FLOW_JOB.CONFIRM_USDT,
        { transactionId: data.transactionId, attempt: data.attempt + 1 },
        {
          jobId: `confirm-${data.transactionId}-${data.attempt + 1}`,
          delay: Math.min(30_000, 2_000 * data.attempt),
        },
      );
    }
  }
}
