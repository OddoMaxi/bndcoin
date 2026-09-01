import request from 'supertest';
import {
  adminToken,
  createTestApp,
  drainQueues,
  registerUser,
  resetDb,
  seedBaseline,
  TestContext,
} from './helpers/test-app';

const TRON_ADDRESS = `T${'1'.repeat(33)}`;

describe('BUY USDT — full simulated happy path', () => {
  let ctx: TestContext;
  let userAuth: Record<string, string>;
  let adminAuth: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await drainQueues(ctx.app);
    await ctx.app.close();
  });

  beforeEach(async () => {
    await drainQueues(ctx.app);
    await resetDb(ctx.prisma);
    await seedBaseline(ctx.prisma);
    userAuth = { Authorization: `Bearer ${(await registerUser(ctx.server)).accessToken}` };
    adminAuth = { Authorization: `Bearer ${await adminToken(ctx.server, ctx.prisma)}` };
  });

  async function treasury() {
    const res = await request(ctx.server)
      .get('/api/v1/admin/treasury')
      .set(adminAuth)
      .expect(200);
    return {
      usdt: res.body.balances.find((b: any) => b.asset === 'USDT'),
      gnf: res.body.balances.find((b: any) => b.asset === 'GNF'),
    };
  }

  it('quotes, locks liquidity, simulates payment, sends USDT and completes', async () => {
    const pricing = await request(ctx.server).get('/api/v1/pricing/current').expect(200);
    expect(pricing.body.marketRate).toBe('8600');
    expect(pricing.body.buyRate).toBe('8815');

    const quote = await request(ctx.server)
      .post('/api/v1/quotes')
      .set(userAuth)
      .set('Idempotency-Key', 'quote-1')
      .send({ gnfAmount: '1000000' })
      .expect(201);
    expect(quote.body.usdtAmount).toBe('113.442994');
    expect(quote.body.status).toBe('PENDING');

    const accept = await request(ctx.server)
      .post(`/api/v1/quotes/${quote.body.id}/accept`)
      .set(userAuth)
      .set('Idempotency-Key', 'accept-1')
      .send({ destinationAddress: TRON_ADDRESS })
      .expect(201);
    const txId = accept.body.id;
    expect(accept.body.status).toBe('WAITING_PAYMENT');
    expect(accept.body.paymentInstructions.amount).toBe('1000000');

    const afterLock = await treasury();
    expect(afterLock.usdt.reserved).toBe('113.442994');
    expect(afterLock.usdt.available).toBe('99886.557006');

    const settled = await request(ctx.server)
      .post(`/api/v1/mock/payment/${txId}/event`)
      .set(adminAuth)
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);
    expect(settled.body.status).toBe('COMPLETED');
    expect(settled.body.cryptoTxHash).toMatch(/^[0-9a-f]{64}$/);
    expect(settled.body.cryptoConfirmations).toBe(3);

    const afterComplete = await treasury();
    expect(afterComplete.usdt.reserved).toBe('0.000000');
    expect(afterComplete.usdt.available).toBe('99886.557006');
    expect(afterComplete.gnf.available).toBe('5001000000');

    const tx = await request(ctx.server)
      .get(`/api/v1/transactions/${txId}`)
      .set(userAuth)
      .expect(200);
    expect(tx.body.events.map((e: any) => e.nextStatus)).toEqual([
      'CREATED',
      'QUOTE_LOCKED',
      'WAITING_PAYMENT',
      'PAYMENT_DETECTED',
      'PAYMENT_CONFIRMED',
      'USDT_PROCESSING',
      'USDT_SENT',
      'COMPLETED',
    ]);

    const audit = await request(ctx.server)
      .get(`/api/v1/admin/audit-logs?entityType=Transaction&entityId=${txId}`)
      .set(adminAuth)
      .expect(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(6);

    const ledger = await request(ctx.server)
      .get('/api/v1/admin/treasury/ledger?asset=USDT')
      .set(adminAuth)
      .expect(200);
    expect(ledger.body.items.some((i: any) => i.refType === 'RESERVATION')).toBe(true);
    expect(ledger.body.items.some((i: any) => i.refType === 'RESERVATION_CONSUME')).toBe(true);
  });

  it('replays the same transaction for a repeated accept with the same Idempotency-Key', async () => {
    const quote = await request(ctx.server)
      .post('/api/v1/quotes')
      .set(userAuth)
      .set('Idempotency-Key', 'quote-2')
      .send({ gnfAmount: '500000' })
      .expect(201);

    const first = await request(ctx.server)
      .post(`/api/v1/quotes/${quote.body.id}/accept`)
      .set(userAuth)
      .set('Idempotency-Key', 'accept-2')
      .send({ destinationAddress: TRON_ADDRESS })
      .expect(201);

    const replay = await request(ctx.server)
      .post(`/api/v1/quotes/${quote.body.id}/accept`)
      .set(userAuth)
      .set('Idempotency-Key', 'accept-2')
      .send({ destinationAddress: TRON_ADDRESS })
      .expect(201);

    expect(replay.body.id).toBe(first.body.id);
    expect(replay.headers['idempotent-replay']).toBe('true');

    const count = await ctx.prisma.transaction.count();
    expect(count).toBe(1);
  });

  it('rejects a second different quote body under the same Idempotency-Key', async () => {
    await request(ctx.server)
      .post('/api/v1/quotes')
      .set(userAuth)
      .set('Idempotency-Key', 'dupe-key')
      .send({ gnfAmount: '500000' })
      .expect(201);

    await request(ctx.server)
      .post('/api/v1/quotes')
      .set(userAuth)
      .set('Idempotency-Key', 'dupe-key')
      .send({ gnfAmount: '600000' })
      .expect(409);
  });
});
