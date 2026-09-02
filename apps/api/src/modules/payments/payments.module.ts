import { Module } from '@nestjs/common';
import { OrangeModule } from '../orange/orange.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [OrangeModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayoutsService],
  exports: [PaymentsService, PayoutsService],
})
export class PaymentsModule {}
