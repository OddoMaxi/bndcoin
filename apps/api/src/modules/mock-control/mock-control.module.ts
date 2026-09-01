import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { MockControlController } from './mock-control.controller';
import { MockControlService } from './mock-control.service';
import { MockEnabledGuard } from './mock.guard';

@Module({
  imports: [TransactionsModule],
  controllers: [MockControlController],
  providers: [MockControlService, MockEnabledGuard],
})
export class MockControlModule {}
