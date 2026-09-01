import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module';
import { AppConfigService } from './common/config/app-config.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './common/audit/audit.module';
import { RbacModule } from './common/rbac/rbac.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { QueueModule } from './common/queue/queue.module';
import { MockModule } from './common/mock/mock.module';
import { HealthModule } from './common/health/health.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { PaymentProvidersModule } from './modules/payment-providers/payment-providers.module';
import { CryptoProvidersModule } from './modules/crypto-providers/crypto-providers.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AdminModule } from './modules/admin/admin.module';
import { MockControlModule } from './modules/mock-control/mock-control.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    MockModule,
    AuditModule,
    RbacModule,
    IdempotencyModule,
    QueueModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          { ttl: config.rateLimit.ttl * 1000, limit: config.rateLimit.limit },
        ],
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    PricingModule,
    QuotesModule,
    TreasuryModule,
    PaymentProvidersModule,
    CryptoProvidersModule,
    TransactionsModule,
    AuditLogsModule,
    AdminModule,
    MockControlModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
