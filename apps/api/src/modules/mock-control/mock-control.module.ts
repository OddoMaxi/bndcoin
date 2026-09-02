import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { TicketsModule } from '../tickets/tickets.module';
import { MockControlController, MockEnabledGuard } from './mock-control.controller';

@Module({
  imports: [CryptoModule, TicketsModule],
  controllers: [MockControlController],
  providers: [MockEnabledGuard],
})
export class MockControlModule {}
