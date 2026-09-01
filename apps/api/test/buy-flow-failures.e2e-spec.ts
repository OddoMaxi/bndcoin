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

async function newQuote(ctx: TestContext, auth: Record<string, string>, gnfAmount = '1000000') {
  const res = await request(ctx.server)
    .post('/api/v1/quotes')
    .set(auth)
    .set('Idempotency-Key', `q-${Math.random()}`)
    .send({ gnfAmount })
    .expect(201);
  return res.body;
}

async function accept(ctx: TestContext, auth: Record<string, string>, quoteId: string) {
  const res = await request(ctx.server)
    .post(`/api/v1/quotes/${quoteId}/accept`)
    .set(auth)
    .set('Idempotency-Key', `a-${Math.random()}`)
    .send({ destinationAddress: TRON_ADDRESS })
    .expect(201);
  return res.body;
}

async function usdtBalance(ctx: TestContext, adminAuth: Record<string, string>) {
  const res = await request(ctx.server).get('/api/v1/admin/treasury').set(adminAuth).expect(200);
  return res.body.balances.find((b: any) => b.asset === 'USDT');
}

describe('BUY USDT — failure & edge paths', () => {
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

  it('PAYMENT_FAILED -> FAILED and releases the USDT reservation', async () => {
    const q = await newQuote(ctx, userAuth);
    const tx = await accept(ctx, userAuth, q.id);
    expect((await usdtBalance(ctx, adminAuth)).reserved).toBe(q.usdtAmount);

    const res = await request(ctx.server)
      .post(`/api/v1/mock/payment/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'PAYMENT_FAILED' })
      .expect(201);
    expect(res.body.status).toBe('FAILED');

    const usdt = await usdtBalance(ctx, adminAuth);
    expect(usdt.reserved).toBe('0.000000');
    expect(usdt.available).toBe('100000.000000');
  });

  it('TIMEOUT -> EXPIRED and releases the reservation', async () => {
    const q = await newQuote(ctx, userAuth);
    const tx = await accept(ctx, userAuth, q.id);

    const res = await request(ctx.server)
      .post(`/api/v1/mock/payment/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'TIMEOUT' })
      .expect(201);
    expect(res.body.status).toBe('EXPIRED');
    expect((await usdtBalance(ctx, adminAuth)).reserved).toBe('0.000000');
  });

  it('rejects acceptance when USDT liquidity is insufficient (409)', async () => {
    await ctx.prisma.treasuryAccount.update({
      where: { asset: 'USDT' },
      data: { available: '10' },
    });
    const q = await newQuote(ctx, userAuth);
    await request(ctx.server)
      .post(`/api/v1/quotes/${q.id}/accept`)
      .set(userAuth)
      .set('Idempotency-Key', `a-${Math.random()}`)
      .send({ destinationAddress: TRON_ADDRESS })
      .expect(409);
  });

  it('crypto FAILED after payment -> MANUAL_REVIEW (GNF kept, USDT still reserved)', async () => {
    const q = await newQuote(ctx, userAuth);
    const tx = await accept(ctx, userAuth, q.id);

    await request(ctx.server)
      .post(`/api/v1/mock/crypto/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'FAILED' })
      .expect(201);

    const res = await request(ctx.server)
      .post(`/api/v1/mock/payment/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);

    expect(res.body.status).toBe('MANUAL_REVIEW');
    const usdt = await usdtBalance(ctx, adminAuth);
    expect(usdt.reserved).toBe(q.usdtAmount);

    // admin resolves by retrying the USDT leg after clearing the failure
    await request(ctx.server)
      .post(`/api/v1/mock/crypto/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'CONFIRMED' })
      .expect(201);
    const resolved = await request(ctx.server)
      .post(`/api/v1/admin/transactions/${tx.id}/review/resolve`)
      .set(adminAuth)
      .send({ decision: 'RETRY_USDT', reason: 'provider recovered' })
      .expect(201);
    expect(resolved.body.status).toBe('COMPLETED');
    expect((await usdtBalance(ctx, adminAuth)).reserved).toBe('0.000000');
  });

  it('rejects accepting an expired quote (410)', async () => {
    const q = await newQuote(ctx, userAuth);
    await ctx.prisma.quote.update({
      where: { id: q.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(ctx.server)
      .post(`/api/v1/quotes/${q.id}/accept`)
      .set(userAuth)
      .set('Idempotency-Key', `a-${Math.random()}`)
      .send({ destinationAddress: TRON_ADDRESS })
      .expect(410);
  });

  it('DELAYED settles on a later drive() call', async () => {
    const q = await newQuote(ctx, userAuth);
    const tx = await accept(ctx, userAuth, q.id);

    const first = await request(ctx.server)
      .post(`/api/v1/mock/payment/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'DELAYED' })
      .expect(201);
    expect(['PAYMENT_DETECTED', 'WAITING_PAYMENT']).toContain(first.body.status);

    // flip to immediate success and re-drive
    const done = await request(ctx.server)
      .post(`/api/v1/mock/payment/${tx.id}/event`)
      .set(adminAuth)
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);
    expect(done.body.status).toBe('COMPLETED');
  });
});
