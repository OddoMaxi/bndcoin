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

describe('Treasury — no overselling under concurrency', () => {
  let ctx: TestContext;

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
    // Only enough USDT for a single ~113 USDT order.
    await seedBaseline(ctx.prisma, { usdtAvailable: '150' });
  });

  it('lets exactly one of two concurrent accepts reserve the last of the float', async () => {
    const auth = { Authorization: `Bearer ${(await registerUser(ctx.server)).accessToken}` };
    const adminAuth = { Authorization: `Bearer ${await adminToken(ctx.server, ctx.prisma)}` };

    const quotes = await Promise.all(
      [0, 1].map((i) =>
        request(ctx.server)
          .post('/api/v1/quotes')
          .set(auth)
          .set('Idempotency-Key', `q-conc-${i}`)
          .send({ gnfAmount: '1000000' })
          .expect(201)
          .then((r) => r.body),
      ),
    );

    const results = await Promise.allSettled(
      quotes.map((q, i) =>
        request(ctx.server)
          .post(`/api/v1/quotes/${q.id}/accept`)
          .set(auth)
          .set('Idempotency-Key', `a-conc-${i}`)
          .send({ destinationAddress: TRON_ADDRESS }),
      ),
    );

    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : 500,
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);

    const treasury = await request(ctx.server)
      .get('/api/v1/admin/treasury')
      .set(adminAuth)
      .expect(200);
    const usdt = treasury.body.balances.find((b: any) => b.asset === 'USDT');
    expect(usdt.reserved).toBe('113.442994');
    expect(usdt.available).toBe('36.557006');

    const heldCount = await ctx.prisma.liquidityReservation.count({ where: { status: 'HELD' } });
    expect(heldCount).toBe(1);
  });
});
