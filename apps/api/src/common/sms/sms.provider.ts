import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  readonly key: string;
  send(to: string, message: string): Promise<{ providerRef: string; delivered: boolean }>;
}

/** No SMS credentials configured — logs the message and (in mock OTP mode) the code. */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  readonly key = 'mock';
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(to: string, message: string) {
    this.logger.log(`[mock-sms] -> ${to}: ${message}`);
    return { providerRef: `MOCK-SMS-${Date.now()}`, delivered: true };
  }
}

/** Placeholder for a real aggregator (Orange SMS API / Twilio / etc). Unconfigured. */
@Injectable()
export class LiveSmsProvider implements SmsProvider {
  readonly key = 'live';
  constructor(private readonly config: AppConfigService) {}
  async send(): Promise<{ providerRef: string; delivered: boolean }> {
    throw new Error('LiveSmsProvider is not configured. Set OTP_MODE=live with real credentials.');
  }
}
