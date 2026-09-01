import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { CRYPTO_PROVIDER } from './crypto-provider.interface';
import { MockCryptoProvider } from './mock/mock-crypto.provider';

@Module({
  providers: [
    MockCryptoProvider,
    {
      provide: CRYPTO_PROVIDER,
      inject: [AppConfigService, MockCryptoProvider],
      useFactory: (config: AppConfigService, mock: MockCryptoProvider) => {
        switch (config.providers.crypto) {
          case 'mock':
            return mock;
          default:
            throw new Error(
              `Unsupported CRYPTO_PROVIDER "${config.providers.crypto}". Only "mock" is implemented in this iteration.`,
            );
        }
      },
    },
  ],
  exports: [CRYPTO_PROVIDER],
})
export class CryptoProvidersModule {}
