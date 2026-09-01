import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AppConfigService } from '../../common/config/app-config.service';
import { QUEUE, QUOTES_JOB } from '../../common/queue/queue.constants';
import { QuotesService } from './quotes.service';

@Injectable()
@Processor(QUEUE.QUOTES)
export class QuoteSweeperProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(QuoteSweeperProcessor.name);

  constructor(
    @InjectQueue(QUEUE.QUOTES) private readonly queue: Queue,
    private readonly quotes: QuotesService,
    private readonly config: AppConfigService,
  ) {
    super();
  }

  async onModuleInit() {
    // Idempotent: repeatable jobs are de-duplicated by name + repeat options.
    await this.queue.add(
      QUOTES_JOB.SWEEP_EXPIRED,
      {},
      {
        repeat: { every: this.config.flow.quoteSweepIntervalSeconds * 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log(
      `Quote sweep scheduled every ${this.config.flow.quoteSweepIntervalSeconds}s`,
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === QUOTES_JOB.SWEEP_EXPIRED) {
      await this.quotes.expireStale();
    }
  }
}
