import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE.BUY_FLOW }, { name: QUEUE.QUOTES }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
