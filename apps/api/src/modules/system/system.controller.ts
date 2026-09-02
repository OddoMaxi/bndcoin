import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, RequirePermission } from '../../common/rbac/decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LedgerService } from '../../common/ledger/ledger.service';

@ApiTags('system')
@Controller()
export class SystemController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ledger: LedgerService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', ts: new Date().toISOString(), uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping(),
    ]);
    return { status: db && redis ? 'ok' : 'degraded', db, redis };
  }

  @RequirePermission('system.health')
  @Get('admin/system/health')
  async systemHealth() {
    const [db, redis, integrity, modems, watcherJobs, stuckPayments] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping(),
      this.ledger.integrityCheck(),
      this.prisma.orangeModem.findMany({ select: { name: true, status: true, enabled: true, lastHealthcheckAt: true } }),
      this.redis.client.keys('bull:*').then((k) => k.length).catch(() => -1),
      this.prisma.paymentIntent.count({
        where: { status: { in: ['AWAITING_PAYMENT', 'PAYMENT_DETECTED'] }, createdAt: { lt: new Date(Date.now() - 3_600_000) } },
      }),
    ]);
    return {
      mode: {
        realMoney: this.config.realMoneyMode,
        realCrypto: this.config.realCryptoMode,
        orange: this.config.orangeMode,
        otp: this.config.otpMode,
        blockchain: this.config.blockchainProvider,
        env: this.config.nodeEnv,
      },
      services: { database: db, redis, queueKeys: watcherJobs },
      ledger: integrity,
      modems,
      stuckPayments,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}
