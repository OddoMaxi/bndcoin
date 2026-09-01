import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE } from '../../common/queue/queue.constants';
import { CryptoProvidersModule } from '../crypto-providers/crypto-providers.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { QuotesModule } from '../quotes/quotes.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { BuyFlowService } from './buy-flow.service';
import { BuyFlowProcessor } from './processors/buy-flow.processor';
import { TransactionStateMachine } from './state-machine/transaction-state-machine.service';
import { TransactionsAdminController } from './transactions.admin.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    QuotesModule,
    TreasuryModule,
    PaymentProvidersModule,
    CryptoProvidersModule,
    BullModule.registerQueue({ name: QUEUE.BUY_FLOW }),
  ],
  controllers: [TransactionsController, TransactionsAdminController],
  providers: [TransactionStateMachine, BuyFlowService, TransactionsService, BuyFlowProcessor],
  exports: [TransactionStateMachine, BuyFlowService, TransactionsService],
})
export class TransactionsModule {}
