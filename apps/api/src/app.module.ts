import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TestAwareThrottlerGuard } from './common/rate-limit/test-aware-throttler.guard';
import { AppConfigModule } from './common/config/config.module';
import { AppConfigService } from './common/config/app-config.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './common/audit/audit.module';
import { RbacModule } from './common/rbac/rbac.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { QueueModule } from './common/queue/queue.module';
import { MockModule } from './common/mock/mock.module';
import { LedgerModule } from './common/ledger/ledger.module';
import { PlatformModule } from './common/platform/platform.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { BootstrapService } from './common/bootstrap/bootstrap.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrangeModule } from './modules/orange/orange.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { EventsModule } from './modules/events/events.module';
import { OrganizersModule } from './modules/organizers/organizers.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { AdminModule } from './modules/admin/admin.module';
import { MockControlModule } from './modules/mock-control/mock-control.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    MockModule,
    AuditModule,
    LedgerModule,
    PlatformModule,
    RbacModule,
    IdempotencyModule,
    QueueModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: config.rateLimit.ttl * 1000, limit: config.rateLimit.limit }],
      }),
    }),
    AuthModule,
    UsersModule,
    TreasuryModule,
    SuppliersModule,
    PricingModule,
    CryptoModule,
    PaymentsModule,
    OrangeModule,
    ReconciliationModule,
    EventsModule,
    OrganizersModule,
    TicketsModule,
    SettlementsModule,
    AdminModule,
    MockControlModule,
    AuditLogsModule,
    SystemModule,
  ],
  providers: [
    BootstrapService,
    { provide: APP_GUARD, useClass: TestAwareThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
