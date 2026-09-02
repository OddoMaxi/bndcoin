import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { QUEUE } from '../../src/common/queue/queue.constants';

export interface Ctx {
  app: INestApplication;
  prisma: PrismaService;
  server: Server;
}

export async function boot(): Promise<Ctx> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService), server: app.getHttpServer() };
}

export async function drainQueues(app: INestApplication) {
  for (const n of Object.values(QUEUE)) {
    try {
      await app.get<Queue>(getQueueToken(n)).obliterate({ force: true });
    } catch {
      /* ignore */
    }
  }
  try {
    await app.get(RedisService).client.flushall();
  } catch {
    /* ignore */
  }
}

export async function resetDb(prisma: PrismaService) {
  const tables: string[] = (
    await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map((r) => `"${r.tablename}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

/** Structural + fixture seed for tests (small numbers, deterministic pricing). */
export async function seed(prisma: PrismaService, opts: { usdtHot?: string; gnfPdv?: string } = {}) {
  const acc = [
    ['ASSET_GNF', 'ASSET', 'GNF', 'DEBIT'],
    ['GNF_PDV_01', 'ASSET', 'GNF', 'DEBIT'],
    ['GNF_PDV_02', 'ASSET', 'GNF', 'DEBIT'],
    ['GNF_CASH_CLEARING', 'ASSET', 'GNF', 'DEBIT'],
    ['ASSET_USDT', 'ASSET', 'USDT', 'DEBIT'],
    ['USDT_HOT_WALLET', 'ASSET', 'USDT', 'DEBIT'],
    ['USDT_COLD_STORAGE', 'ASSET', 'USDT', 'DEBIT'],
    ['USDT_IN_TRANSIT', 'ASSET', 'USDT', 'DEBIT'],
    ['USDT_INVENTORY', 'ASSET', 'USDT', 'DEBIT'],
    ['CUSTOMER_FUNDS', 'LIABILITY', 'GNF', 'CREDIT'],
    ['CUSTOMER_FUNDS_USDT', 'LIABILITY', 'USDT', 'CREDIT'],
    ['ORGANIZER_PAYABLE', 'LIABILITY', 'GNF', 'CREDIT'],
    ['PLATFORM_REVENUE', 'REVENUE', 'GNF', 'CREDIT'],
    ['FEES_REVENUE', 'REVENUE', 'GNF', 'CREDIT'],
    ['TRADING_MARGIN', 'REVENUE', 'GNF', 'CREDIT'],
    ['COGS_USDT', 'EXPENSE', 'GNF', 'DEBIT'],
    ['TREASURY_ADJUSTMENT', 'EXPENSE', 'GNF', 'DEBIT'],
    ['TREASURY_ADJUSTMENT_USDT', 'EXPENSE', 'USDT', 'DEBIT'],
  ];
  for (const [code, type, currency, normalSide] of acc) {
    await prisma.ledgerAccount.upsert({
      where: { code },
      update: {},
      create: { code, name: code, type, currency: currency as never, normalSide: normalSide as never },
    });
  }
  for (const [asset, buckets] of [
    ['GNF', ['MAIN', 'PDV_01', 'PDV_02', 'IN_TRANSIT']],
    ['USDT', ['MAIN', 'HOT', 'COLD', 'IN_TRANSIT']],
  ] as const) {
    for (const bucket of buckets) {
      await prisma.treasuryAccount.upsert({
        where: { asset_bucket: { asset, bucket } },
        update: {},
        create: { asset, bucket },
      });
    }
  }
  const usdtHot = opts.usdtHot ?? '50000';
  const gnfPdv = opts.gnfPdv ?? '2000000000';
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'USDT', bucket: 'HOT' } }, data: { available: usdtHot } });
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'GNF', bucket: 'PDV_01' } }, data: { available: gnfPdv } });

  const j = await prisma.ledgerJournal.create({
    data: { reference: 'seed', referenceType: 'seed_opening', referenceId: 'genesis' },
  });
  const id = async (c: string) => (await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: c } })).id;
  await prisma.ledgerEntry.createMany({
    data: [
      { journalId: j.id, accountId: await id('USDT_HOT_WALLET'), currency: 'USDT', direction: 'DEBIT', amount: usdtHot },
      { journalId: j.id, accountId: await id('TREASURY_ADJUSTMENT_USDT'), currency: 'USDT', direction: 'CREDIT', amount: usdtHot },
      { journalId: j.id, accountId: await id('GNF_PDV_01'), currency: 'GNF', direction: 'DEBIT', amount: gnfPdv },
      { journalId: j.id, accountId: await id('TREASURY_ADJUSTMENT'), currency: 'GNF', direction: 'CREDIT', amount: gnfPdv },
    ],
  });
  await prisma.inventoryLot.create({
    data: { sourceType: 'SUPPLIER_PURCHASE', sourceRef: 'seed', asset: 'USDT', quantity: usdtHot, quantityRemaining: usdtHot, unitCostGnf: '8600' },
  });

  await prisma.pricingConfig.create({
    data: {
      referenceRate: '9000',
      riskBufferBps: 0,
      quoteTtlSeconds: 120,
      minGnfAmount: '50000',
      maxGnfAmount: '50000000',
      minUsdtAmount: '1',
      maxUsdtAmount: '100000',
      version: 1,
      active: true,
    },
  });
  await prisma.pricingRule.createMany({
    data: [
      { kind: 'TIER', side: 'BUY_USDT', minUsdt: '0', spreadPct: '0.03', feePct: '0', priority: 100 },
      { kind: 'TIER', side: 'SELL_USDT', minUsdt: '0', spreadPct: '0.03', feePct: '0', priority: 100 },
    ],
  });
  await prisma.transactionLimit.create({
    data: {
      scope: 'GLOBAL',
      refId: '*',
      currency: 'GNF',
      perTxMin: '50000',
      perTxMax: '50000000',
      dailyMax: '500000000',
      monthlyMax: '5000000000',
    },
  });
  const net = await prisma.cryptoNetwork.create({
    data: {
      key: 'TRON',
      asset: 'USDT',
      networkName: 'Tron',
      enabled: true,
      depositEnabled: true,
      withdrawEnabled: true,
      confirmationsRequired: 3,
      minimumAmount: '1',
      addressRegex: '^T[1-9A-HJ-NP-Za-km-z]{33}$',
      status: 'ACTIVE',
    },
  });
  for (const n of ['01', '02']) {
    const sim = await prisma.orangeSim.create({
      data: { msisdn: `+2246200${n}00`, status: 'ACTIVE', balanceGnf: '80000000', dailyLimit: '50000000', monthlyLimit: '1000000000' },
    });
    await prisma.orangeModem.create({
      data: {
        name: `modem-${n}`,
        simId: sim.id,
        phoneNumber: sim.msisdn,
        status: 'ONLINE',
        balanceGnf: '80000000',
        dailyLimit: '50000000',
        enabled: true,
        lastHealthcheckAt: new Date(),
      },
    });
  }

  return { networkId: net.id };
}

export const req = request;
export const TRON = `T${'1'.repeat(33)}`;

export async function otpUser(server: Server, phone: string) {
  const r1 = await request(server).post('/api/v1/auth/otp/request').send({ phone }).expect(200);
  const r2 = await request(server)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: r1.body.debugCode })
    .expect(200);
  return { token: r2.body.accessToken, userId: r2.body.user.id };
}

export async function adminUser(server: Server, prisma: PrismaService) {
  const argon2 = await import('argon2');
  await prisma.user.create({
    data: {
      publicUserId: 'U-ADMIN',
      phone: '+224600000000',
      firstName: 'A',
      lastName: 'D',
      role: 'SUPER_ADMIN',
      passwordHash: await argon2.hash('Admin123!'),
      phoneVerified: true,
    },
  });
  const r = await request(server)
    .post('/api/v1/auth/login')
    .send({ phone: '+224600000000', password: 'Admin123!' })
    .expect(200);
  return r.body.accessToken as string;
}
