/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function upsertUser(params: {
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN' | 'TREASURY_OPS' | 'COMPLIANCE';
  password: string;
}) {
  const passwordHash = await argon2.hash(params.password);
  return prisma.user.upsert({
    where: { phone: params.phone },
    update: { role: params.role, email: params.email },
    create: {
      phone: params.phone,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      status: 'ACTIVE',
      kycLevel: params.role === 'USER' ? 'BASIC' : 'FULL',
      passwordHash,
    },
  });
}

async function main() {
  console.log('Seeding Bory & Norbert...');

  const admin = await upsertUser({
    phone: '+224600000000',
    email: 'admin@bory-norbert.gn',
    firstName: 'Bory',
    lastName: 'Admin',
    role: 'ADMIN',
    password: 'Admin123!',
  });
  await upsertUser({
    phone: '+224600000001',
    email: 'treasury@bory-norbert.gn',
    firstName: 'Norbert',
    lastName: 'Treasury',
    role: 'TREASURY_OPS',
    password: 'Treasury123!',
  });
  await upsertUser({
    phone: '+224600000002',
    email: 'compliance@bory-norbert.gn',
    firstName: 'Aïcha',
    lastName: 'Compliance',
    role: 'COMPLIANCE',
    password: 'Compliance123!',
  });
  await upsertUser({
    phone: '+224610000000',
    email: 'test@bory-norbert.gn',
    firstName: 'Mamadou',
    lastName: 'Diallo',
    role: 'USER',
    password: 'Test123!',
  });

  // --- Pricing: a single active GNF_USDT config, version 1 ---
  const existingActive = await prisma.pricingConfig.findFirst({
    where: { pair: 'GNF_USDT', active: true },
  });
  if (!existingActive) {
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
        createdBy: admin.id,
      },
    });
    console.log('  pricing config v1 created (marketRate=8600, buySpreadBps=250)');
  }

  // --- Treasury accounts ---
  for (const [asset, available] of [
    ['GNF', '5000000000'],
    ['USDT', '100000'],
  ] as const) {
    await prisma.treasuryAccount.upsert({
      where: { asset },
      update: {},
      create: { asset, available, reserved: '0' },
    });
  }
  console.log('  treasury: GNF 5,000,000,000 available / USDT 100,000 available');

  // --- Transaction limits (structure for the future KYC/AML work) ---
  const limits = [
    { scope: 'GLOBAL' as const, refId: '*', perTxMin: '50000', perTxMax: '50000000', dailyMax: '100000000', monthlyMax: '1000000000' },
    { scope: 'KYC_LEVEL' as const, refId: 'NONE', perTxMin: '50000', perTxMax: '2000000', dailyMax: '2000000', monthlyMax: '10000000' },
    { scope: 'KYC_LEVEL' as const, refId: 'BASIC', perTxMin: '50000', perTxMax: '20000000', dailyMax: '50000000', monthlyMax: '300000000' },
    { scope: 'KYC_LEVEL' as const, refId: 'FULL', perTxMin: '50000', perTxMax: '50000000', dailyMax: '200000000', monthlyMax: '2000000000' },
  ];
  for (const l of limits) {
    await prisma.transactionLimit.upsert({
      where: { scope_refId_currency: { scope: l.scope, refId: l.refId, currency: 'GNF' } },
      update: {},
      create: {
        scope: l.scope,
        refId: l.refId,
        currency: 'GNF',
        perTxMin: l.perTxMin,
        perTxMax: l.perTxMax,
        dailyMax: l.dailyMax,
        monthlyMax: l.monthlyMax,
      },
    });
  }
  console.log('  transaction limits seeded');

  console.log('Seed complete.');
  console.log('  Admin      +224600000000 / Admin123!');
  console.log('  Treasury   +224600000001 / Treasury123!');
  console.log('  Compliance +224600000002 / Compliance123!');
  console.log('  User       +224610000000 / Test123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
