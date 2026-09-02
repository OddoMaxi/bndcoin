import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { QUEUE } from '../../common/queue/queue.constants';
import { PricingModule } from '../pricing/pricing.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import {
  BLOCKCHAIN_PROVIDER,
  LiveBlockchainProvider,
  MockBlockchainProvider,
} from './blockchain.provider';
import { CryptoController } from './crypto.controller';
import { CryptoNetworksService } from './crypto-networks.service';
import { CryptoProcessor } from './crypto.processor';
import { CryptoService } from './crypto.service';

@Module({
  imports: [
    PricingModule,
    TreasuryModule,
    SuppliersModule,
    PaymentsModule,
    UsersModule,
    BullModule.registerQueue({ name: QUEUE.CRYPTO }),
  ],
  controllers: [CryptoController],
  providers: [
    CryptoService,
    CryptoNetworksService,
    CryptoProcessor,
    MockBlockchainProvider,
    LiveBlockchainProvider,
    {
      provide: BLOCKCHAIN_PROVIDER,
      inject: [AppConfigService, MockBlockchainProvider, LiveBlockchainProvider],
      useFactory: (config: AppConfigService, mock: MockBlockchainProvider, live: LiveBlockchainProvider) =>
        config.blockchainProvider === 'live' ? live : mock,
    },
  ],
  exports: [CryptoService, CryptoNetworksService],
})
export class CryptoModule {}
