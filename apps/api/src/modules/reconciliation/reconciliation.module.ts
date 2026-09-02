import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [ReconciliationController],
})
export class ReconciliationModule {}
