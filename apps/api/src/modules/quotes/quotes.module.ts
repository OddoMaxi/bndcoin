import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE } from '../../common/queue/queue.constants';
import { PricingModule } from '../pricing/pricing.module';
import { QuoteSweeperProcessor } from './quote-sweeper.processor';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PricingModule, BullModule.registerQueue({ name: QUEUE.QUOTES })],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteSweeperProcessor],
  exports: [QuotesService],
})
export class QuotesModule {}
