import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SMS_PROVIDER, LiveSmsProvider, MockSmsProvider } from '../../common/sms/sms.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    MockSmsProvider,
    LiveSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [AppConfigService, MockSmsProvider, LiveSmsProvider],
      useFactory: (config: AppConfigService, mock: MockSmsProvider, live: LiveSmsProvider) =>
        config.otpMode === 'live' ? live : mock,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
