import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { ORANGE_PROVIDER } from './orange-provider.interface';
import { MockOrangeMoneyProvider, ModemOrangeMoneyProvider } from './mock-orange.provider';
import { ModemManager } from './modem-manager.service';
import { OrangeController } from './orange.controller';
import { OrangeService } from './orange.service';

@Module({
  controllers: [OrangeController],
  providers: [
    MockOrangeMoneyProvider,
    ModemOrangeMoneyProvider,
    {
      provide: ORANGE_PROVIDER,
      inject: [AppConfigService, MockOrangeMoneyProvider, ModemOrangeMoneyProvider],
      useFactory: (
        config: AppConfigService,
        mock: MockOrangeMoneyProvider,
        modem: ModemOrangeMoneyProvider,
      ) => (config.orangeMode === 'modem' ? modem : mock),
    },
    ModemManager,
    OrangeService,
  ],
  exports: [ORANGE_PROVIDER, ModemManager, OrangeService],
})
export class OrangeModule {}
