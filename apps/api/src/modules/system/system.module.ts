import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE } from '../../common/queue/queue.constants';
import { PricingModule } from '../pricing/pricing.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { CryptoModule } from '../crypto/crypto.module';
import { OrangeModule } from '../orange/orange.module';
import { SystemController } from './system.controller';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({
  imports: [
    PricingModule,
    TreasuryModule,
    CryptoModule,
    OrangeModule,
    BullModule.registerQueue({ name: QUEUE.MAINTENANCE }),
  ],
  controllers: [SystemController],
  providers: [MaintenanceProcessor],
})
export class SystemModule {}
