import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { QUEUE } from '../../src/common/queue/queue.constants';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  server: Server;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer(),
  };
}

/** Empty the BullMQ queues between specs so stray delayed jobs don't fire. */
export async function drainQueues(app: INestApplication): Promise<void> {
  for (const name of [QUEUE.BUY_FLOW, QUEUE.QUOTES]) {
    const queue = app.get<Queue>(getQueueToken(name));
    await queue.obliterate({ force: true }).catch(() => undefined);
  }
}

/** Wipe every table so each spec starts from a known state. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog","TransactionEvent","TreasuryLedgerEntry","LiquidityReservation",
      "ProviderOperation","MockEvent","IdempotencyKey","RefreshToken",
      "Transaction","Quote","PricingConfig","TreasuryAccount","TransactionLimit",
      "AmlFlag","KycProfile","User"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedBaseline(
  prisma: PrismaService,
  opts: { usdtAvailable?: string; gnfAvailable?: string } = {},
): Promise<void> {
  await prisma.pricingConfig.create({
    data: {
      pair: 'GNF_USDT',
      marketRate: '8600',
      buySpreadBps: 250,
      sellSpreadBps: 250,
      feeGnfFlat: '0',
      minGnfAmount: '50000',
      maxGnfAmount: '50000000',
      quoteTtlSeconds: 90,
      version: 1,
      active: true,
    },
  });
  await prisma.treasuryAccount.createMany({
    data: [
      { asset: 'GNF', available: opts.gnfAvailable ?? '5000000000', reserved: '0' },
      { asset: 'USDT', available: opts.usdtAvailable ?? '100000', reserved: '0' },
    ],
  });
  await prisma.transactionLimit.create({
    data: {
      scope: 'GLOBAL',
      refId: '*',
      currency: 'GNF',
      perTxMin: '50000',
      perTxMax: '50000000',
      dailyMax: '100000000',
      monthlyMax: '1000000000',
    },
  });
}

export async function registerUser(
  server: Server,
  phone = '+224620000001',
): Promise<{ userId: string; accessToken: string }> {
  const request = (await import('supertest')).default;
  const res = await request(server)
    .post('/api/v1/auth/register')
    .send({ phone, password: 'Passw0rd!', firstName: 'Test', lastName: 'User' })
    .expect(201);
  return { userId: res.body.user.id, accessToken: res.body.accessToken };
}

export async function makeAdmin(prisma: PrismaService, phone = '+224600000009'): Promise<string> {
  const user = await prisma.user.create({
    data: {
      phone,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      passwordHash: await argon2.hash('Passw0rd!'),
    },
  });
  return user.id;
}

export async function adminToken(server: Server, prisma: PrismaService): Promise<string> {
  const phone = '+224600000009';
  await makeAdmin(prisma, phone);
  const request = (await import('supertest')).default;
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ phone, password: 'Passw0rd!' })
    .expect(200);
  return res.body.accessToken;
}
