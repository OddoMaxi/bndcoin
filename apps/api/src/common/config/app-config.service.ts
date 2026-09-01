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
  get databaseUrl() {
    return this.get('DATABASE_URL');
  }
  get redisUrl() {
    return this.get('REDIS_URL');
  }
  get corsOrigin() {
    return this.get('CORS_ORIGIN');
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
    };
  }

  get providers() {
    return {
      payment: this.get('PAYMENT_PROVIDER'),
      crypto: this.get('CRYPTO_PROVIDER'),
      mockEnabled: this.get('MOCK_PROVIDERS_ENABLED'),
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
    return {
      ttl: this.get('RATE_LIMIT_TTL'),
      limit: this.get('RATE_LIMIT_LIMIT'),
    };
  }
}
