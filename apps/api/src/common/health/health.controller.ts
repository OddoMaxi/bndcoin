import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../rbac/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async readiness() {
    const [db, redis] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => true)
        .catch(() => false),
      this.redis.ping(),
    ]);
    if (!db || !redis) {
      throw new ServiceUnavailableException({ db, redis });
    }
    return { status: 'ok', db, redis };
  }
}
