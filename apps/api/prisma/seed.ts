/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ACCOUNTS = [
  ['ASSET_GNF', 'GNF assets (aggregate)', 'ASSET', 'GNF', 'DEBIT'],
  ['GNF_PDV_01', 'Orange Money PDV 01 float', 'ASSET', 'GNF', 'DEBIT'],
  ['GNF_PDV_02', 'Orange Money PDV 02 float', 'ASSET', 'GNF', 'DEBIT'],
  ['GNF_CASH_CLEARING', 'GNF in-flight / clearing', 'ASSET', 'GNF', 'DEBIT'],
  ['ASSET_USDT', 'USDT assets (aggregate)', 'ASSET', 'USDT', 'DEBIT'],
  ['USDT_HOT_WALLET', 'USDT hot wallet', 'ASSET', 'USDT', 'DEBIT'],
  ['USDT_COLD_STORAGE', 'USDT cold storage', 'ASSET', 'USDT', 'DEBIT'],
  ['USDT_IN_TRANSIT', 'USDT in transit', 'ASSET', 'USDT', 'DEBIT'],
  ['USDT_INVENTORY', 'USDT inventory cost carrier', 'ASSET', 'USDT', 'DEBIT'],
  ['CUSTOMER_FUNDS', 'Customer funds payable', 'LIABILITY', 'GNF', 'CREDIT'],
  ['CUSTOMER_FUNDS_USDT', 'Customer funds payable (USDT)', 'LIABILITY', 'USDT', 'CREDIT'],
  ['ORGANIZER_PAYABLE', 'Organizer settlement payable', 'LIABILITY', 'GNF', 'CREDIT'],
  ['PLATFORM_REVENUE', 'Platform revenue', 'REVENUE', 'GNF', 'CREDIT'],
  ['FEES_REVENUE', 'Fees revenue', 'REVENUE', 'GNF', 'CREDIT'],
  ['TRADING_MARGIN', 'Crypto trading realized margin', 'REVENUE', 'GNF', 'CREDIT'],
  ['COGS_USDT', 'Cost of USDT sold', 'EXPENSE', 'GNF', 'DEBIT'],
  ['TREASURY_ADJUSTMENT', 'Treasury manual adjustment', 'EXPENSE', 'GNF', 'DEBIT'],
  ['TREASURY_ADJUSTMENT_USDT', 'Treasury manual adjustment (USDT)', 'EXPENSE', 'USDT', 'DEBIT'],
] as const;

async function user(params: {
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  role: any;
  password?: string;
}) {
  const publicUserId = 'U-' + params.phone.replace(/\D/g, '').slice(-9);
  return prisma.user.upsert({
    where: { phone: params.phone },
    update: { role: params.role },
    create: {
      publicUserId,
      phone: params.phone,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      status: 'ACTIVE',
      kycStatus: params.role === 'CUSTOMER' ? 'UNVERIFIED' : 'VERIFIED',
      kycLevel: params.role === 'CUSTOMER' ? 'BASIC' : 'FULL',
      phoneVerified: true,
      passwordHash: params.password ? await argon2.hash(params.password) : null,
    },
  });
}

async function main() {
  console.log('Seeding Bory & Norbert V1...');

  // --- chart of accounts ---
  for (const [code, name, type, currency, normalSide] of ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code },
      update: { name, type, currency: currency as any, normalSide: normalSide as any },
      create: { code, name, type, currency: currency as any, normalSide: normalSide as any },
    });
  }

  // --- treasury buckets ---
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
  // seed operating balances (available)
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'USDT', bucket: 'HOT' } }, data: { available: '50000' } });
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'USDT', bucket: 'COLD' } }, data: { available: '150000' } });
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'GNF', bucket: 'PDV_01' } }, data: { available: '2000000000' } });
  await prisma.treasuryAccount.update({ where: { asset_bucket: { asset: 'GNF', bucket: 'PDV_02' } }, data: { available: '1000000000' } });
  // opening ledger balance so integrity check nets zero-ish
  const existingJournal = await prisma.ledgerJournal.findFirst({ where: { referenceType: 'seed_opening' } });
  if (!existingJournal) {
    const j = await prisma.ledgerJournal.create({ data: { reference: 'seed_opening', referenceType: 'seed_opening', referenceId: 'genesis', memo: 'Opening balances' } });
    const acc = async (code: string) => (await prisma.ledgerAccount.findUniqueOrThrow({ where: { code } })).id;
    await prisma.ledgerEntry.createMany({
      data: [
        { journalId: j.id, accountId: await acc('USDT_HOT_WALLET'), currency: 'USDT', direction: 'DEBIT', amount: '50000' },
        { journalId: j.id, accountId: await acc('USDT_COLD_STORAGE'), currency: 'USDT', direction: 'DEBIT', amount: '150000' },
        { journalId: j.id, accountId: await acc('TREASURY_ADJUSTMENT_USDT'), currency: 'USDT', direction: 'CREDIT', amount: '200000' },
        { journalId: j.id, accountId: await acc('GNF_PDV_01'), currency: 'GNF', direction: 'DEBIT', amount: '2000000000' },
        { journalId: j.id, accountId: await acc('GNF_PDV_02'), currency: 'GNF', direction: 'DEBIT', amount: '1000000000' },
        { journalId: j.id, accountId: await acc('TREASURY_ADJUSTMENT'), currency: 'GNF', direction: 'CREDIT', amount: '3000000000' },
      ],
    });
  }
  // inventory lot for the opening USDT (WAC basis)
  const anyLot = await prisma.inventoryLot.findFirst();
  if (!anyLot) {
    await prisma.inventoryLot.create({
      data: { sourceType: 'SUPPLIER_PURCHASE', sourceRef: 'opening', asset: 'USDT', quantity: '200000', quantityRemaining: '200000', unitCostGnf: '8600' },
    });
  }
  console.log('  ledger + treasury seeded (USDT 200k, GNF 3B)');

  // --- users ---
  const admin = await user({ phone: '+224600000000', email: 'admin@bory-norbert.gn', firstName: 'Bory', lastName: 'Admin', role: 'SUPER_ADMIN', password: 'Admin123!' });
  await user({ phone: '+224600000001', email: 'ops@bory-norbert.gn', firstName: 'Ops', lastName: 'Manager', role: 'OPERATIONS', password: 'Ops123!' });
  await user({ phone: '+224600000002', email: 'treasury@bory-norbert.gn', firstName: 'Treasury', lastName: 'Lead', role: 'TREASURY', password: 'Treasury123!' });
  await user({ phone: '+224600000003', email: 'compliance@bory-norbert.gn', firstName: 'Compliance', lastName: 'Officer', role: 'COMPLIANCE', password: 'Compliance123!' });
  await user({ phone: '+224600000004', email: 'finance@bory-norbert.gn', firstName: 'Finance', lastName: 'Officer', role: 'FINANCE', password: 'Finance123!' });
  await user({ phone: '+224600000005', email: 'events@bory-norbert.gn', firstName: 'Event', lastName: 'Manager', role: 'EVENT_MANAGER', password: 'Events123!' });
  await user({ phone: '+224600000006', email: 'scan@bory-norbert.gn', firstName: 'Gate', lastName: 'Scanner', role: 'SCANNER_OPERATOR', password: 'Scan123!' });
  const testUser = await user({ phone: '+224610000000', email: 'test@bory-norbert.gn', firstName: 'Mamadou', lastName: 'Diallo', role: 'CUSTOMER', password: 'Test123!' });
  const organizerUser = await user({ phone: '+224611111111', email: 'organizer@bory-norbert.gn', firstName: 'Aïcha', lastName: 'Camara', role: 'ORGANIZER', password: 'Organizer123!' });
  for (const u of [testUser, organizerUser]) {
    await prisma.kycRecord.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
  }

  // --- pricing ---
  if (!(await prisma.pricingConfig.findFirst({ where: { active: true } }))) {
    await prisma.pricingConfig.create({
      data: {
        referenceRate: '8900',
        riskBufferBps: 50,
        quoteTtlSeconds: 120,
        minGnfAmount: '50000',
        maxGnfAmount: '50000000',
        minUsdtAmount: '5',
        maxUsdtAmount: '10000',
        version: 1,
        active: true,
        createdBy: admin.id,
      },
    });
  }
  const ruleCount = await prisma.pricingRule.count();
  if (ruleCount === 0) {
    await prisma.pricingRule.createMany({
      data: [
        { kind: 'TIER', side: 'BUY_USDT', minUsdt: '0', maxUsdt: '500', spreadPct: '0.035', feePct: '0.005', priority: 100 },
        { kind: 'TIER', side: 'BUY_USDT', minUsdt: '500', maxUsdt: '5000', spreadPct: '0.028', feePct: '0.004', priority: 110 },
        { kind: 'TIER', side: 'BUY_USDT', minUsdt: '5000', spreadPct: '0.022', feePct: '0.003', priority: 120 },
        { kind: 'TIER', side: 'SELL_USDT', minUsdt: '0', maxUsdt: '500', spreadPct: '0.035', feePct: '0.005', priority: 100 },
        { kind: 'TIER', side: 'SELL_USDT', minUsdt: '500', maxUsdt: '5000', spreadPct: '0.028', feePct: '0.004', priority: 110 },
        { kind: 'TIER', side: 'SELL_USDT', minUsdt: '5000', spreadPct: '0.022', feePct: '0.003', priority: 120 },
      ],
    });
  }
  console.log('  pricing config v1 + 6 tier rules');

  // --- transaction limits ---
  for (const l of [
    { scope: 'GLOBAL', refId: '*', perTxMin: '50000', perTxMax: '50000000', dailyMax: '100000000', monthlyMax: '1000000000' },
    { scope: 'KYC_LEVEL', refId: 'NONE', perTxMin: '50000', perTxMax: '2000000', dailyMax: '2000000', monthlyMax: '10000000' },
    { scope: 'KYC_LEVEL', refId: 'BASIC', perTxMin: '50000', perTxMax: '20000000', dailyMax: '50000000', monthlyMax: '300000000' },
    { scope: 'KYC_LEVEL', refId: 'FULL', perTxMin: '50000', perTxMax: '50000000', dailyMax: '200000000', monthlyMax: '2000000000' },
  ] as const) {
    await prisma.transactionLimit.upsert({
      where: { scope_refId_currency: { scope: l.scope, refId: l.refId, currency: 'GNF' } },
      update: {},
      create: { ...l, currency: 'GNF' },
    });
  }

  // --- crypto network (TRON only, enabled) ---
  await prisma.cryptoNetwork.upsert({
    where: { key: 'TRON' },
    update: { enabled: true, depositEnabled: true, withdrawEnabled: true, status: 'ACTIVE' },
    create: {
      key: 'TRON',
      asset: 'USDT',
      networkName: 'Tron (TRC-20)',
      enabled: true,
      depositEnabled: true,
      withdrawEnabled: true,
      confirmationsRequired: 3,
      minimumAmount: '5',
      withdrawalFee: '1',
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      explorerUrl: 'https://tronscan.org/#/transaction/',
      addressRegex: '^T[1-9A-HJ-NP-Za-km-z]{33}$',
      status: 'ACTIVE',
    },
  });
  await prisma.cryptoNetwork.upsert({
    where: { key: 'ETH' },
    update: {},
    create: { key: 'ETH', asset: 'USDT', networkName: 'Ethereum (ERC-20)', confirmationsRequired: 12, minimumAmount: '20', withdrawalFee: '8', addressRegex: '^0x[0-9a-fA-F]{40}$', status: 'DISABLED' },
  });
  console.log('  crypto networks: TRON (active), ETH (disabled)');

  // --- orange gateway + 2 modems + SIMs ---
  await prisma.orangeGateway.upsert({ where: { name: 'gw-central' }, update: {}, create: { name: 'gw-central', mode: 'mock', status: 'ONLINE' } });
  for (const n of ['01', '02']) {
    const sim = await prisma.orangeSim.upsert({
      where: { msisdn: `+22462222${n}22` },
      update: {},
      create: { msisdn: `+22462222${n}22`, label: `PDV SIM ${n}`, status: 'ACTIVE', balanceGnf: '80000000', dailyLimit: '50000000', monthlyLimit: '1000000000' },
    });
    await prisma.orangeModem.upsert({
      where: { name: `modem-${n}` },
      update: { status: 'ONLINE', enabled: true },
      create: {
        name: `modem-${n}`,
        serialPort: `/dev/ttyUSB${Number(n) - 1}`,
        imei: `35000000000000${n}`,
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
  console.log('  orange: gateway + modem-01 + modem-02 (ONLINE, mock)');

  // --- sample organizer + event ---
  const org = await prisma.organizer.upsert({
    where: { userId: organizerUser.id },
    update: { status: 'APPROVED' },
    create: {
      userId: organizerUser.id,
      name: 'Conakry Live Productions',
      slug: 'conakry-live',
      status: 'APPROVED',
      commissionPct: '0.06',
      payoutMsisdn: '+224611111111',
      contactEmail: 'organizer@bory-norbert.gn',
    },
  });
  let event = await prisma.event.findFirst({ where: { organizerId: org.id } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        organizerId: org.id,
        title: 'Nuit Afro Vibes — Conakry',
        slug: 'nuit-afro-vibes-conakry',
        description: 'Une nuit de musique afro avec les meilleurs artistes de la sous-région. DJ sets, live band, food court.',
        category: 'CONCERT',
        venue: 'Palais du Peuple',
        address: 'Boulevard du Commerce, Kaloum',
        city: 'Conakry',
        country: 'GN',
        eventDate: new Date(Date.now() + 21 * 86400000),
        startTime: '21:00',
        endTime: '04:00',
        salesEnd: new Date(Date.now() + 20 * 86400000),
        status: 'PUBLISHED',
        featured: true,
        coverImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200',
      },
    });
    await prisma.ticketType.createMany({
      data: [
        { eventId: event.id, name: 'Standard', description: 'Accès général', priceGnf: '150000', priceUsdt: '17', quantity: 500, maxPerOrder: 6 },
        { eventId: event.id, name: 'VIP', description: 'Zone VIP + 1 boisson', priceGnf: '400000', priceUsdt: '45', quantity: 120, maxPerOrder: 4 },
        { eventId: event.id, name: 'VVIP', description: 'Carré or, table, bouteille', priceGnf: '1500000', priceUsdt: '170', quantity: 20, maxPerOrder: 2 },
      ],
    });
  }
  console.log('  sample event: "Nuit Afro Vibes" with Standard/VIP/VVIP');

  console.log('\nSeed complete.');
  console.log('  SUPER_ADMIN  +224600000000 / Admin123!');
  console.log('  OPERATIONS   +224600000001 / Ops123!');
  console.log('  TREASURY     +224600000002 / Treasury123!');
  console.log('  COMPLIANCE   +224600000003 / Compliance123!');
  console.log('  FINANCE      +224600000004 / Finance123!');
  console.log('  EVENT_MGR    +224600000005 / Events123!');
  console.log('  SCANNER      +224600000006 / Scan123!');
  console.log('  ORGANIZER    +224611111111 / Organizer123!');
  console.log('  CUSTOMER     +224610000000 / Test123!  (or phone+OTP)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
