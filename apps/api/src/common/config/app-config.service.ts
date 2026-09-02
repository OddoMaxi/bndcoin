import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.validation';

/** Typed, centralised access to validated configuration. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv() {
    return this.get('NODE_ENV');
  }
  get isProduction() {
    return this.nodeEnv === 'production';
  }
  get isTest() {
    return this.nodeEnv === 'test';
  }
  get apiPort() {
    return this.get('API_PORT');
  }
  get appUrl() {
    return this.get('APP_URL');
  }
  get databaseUrl() {
    return this.get('DATABASE_URL');
  }
  get redisUrl() {
    return this.get('REDIS_URL');
  }
  get corsOrigin() {
    return this.get('CORS_ORIGIN');
  }
  get qrSigningSecret() {
    return this.get('QR_SIGNING_SECRET');
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
    };
  }

  get realMoneyMode() {
    return this.get('REAL_MONEY_MODE');
  }
  get realCryptoMode() {
    return this.get('REAL_CRYPTO_MODE');
  }
  get orangeMode() {
    return this.get('ORANGE_MODE');
  }
  get otpMode() {
    return this.get('OTP_MODE');
  }
  get blockchainProvider() {
    return this.get('BLOCKCHAIN_PROVIDER');
  }
  get mockEnabled() {
    return this.get('MOCK_PROVIDERS_ENABLED');
  }

  get pricing() {
    return {
      quoteTtl: this.get('DEFAULT_QUOTE_TTL'),
      buySpreadBps: this.get('DEFAULT_BUY_SPREAD_BPS'),
      sellSpreadBps: this.get('DEFAULT_SELL_SPREAD_BPS'),
    };
  }

  get flow() {
    return {
      paymentWindowSeconds: this.get('PAYMENT_WINDOW_SECONDS'),
      quoteSweepIntervalSeconds: this.get('QUOTE_SWEEP_INTERVAL_SECONDS'),
      requiredConfirmations: this.get('CRYPTO_REQUIRED_CONFIRMATIONS'),
    };
  }

  get rateLimit() {
    return { ttl: this.get('RATE_LIMIT_TTL'), limit: this.get('RATE_LIMIT_LIMIT') };
  }
}
