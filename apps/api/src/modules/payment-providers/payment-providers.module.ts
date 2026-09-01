import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockOrangeMoneyProvider } from './mock/mock-orange-money.provider';

@Module({
  providers: [
    MockOrangeMoneyProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [AppConfigService, MockOrangeMoneyProvider],
      useFactory: (config: AppConfigService, mock: MockOrangeMoneyProvider) => {
        switch (config.providers.payment) {
          case 'mock':
            return mock;
          default:
            throw new Error(
              `Unsupported PAYMENT_PROVIDER "${config.providers.payment}". Only "mock" is implemented in this iteration.`,
            );
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
