import {
  adminUser,
  boot,
  Ctx,
  drainQueues,
  otpUser,
  req,
  resetDb,
  seed,
  TRON,
} from './helpers/harness';

describe('Crypto BUY & SELL — full simulated flows', () => {
  let ctx: Ctx;
  let userToken: string;
  let adminToken: string;
  let networkId: string;

  beforeAll(async () => {
    ctx = await boot();
  });
  afterAll(async () => {
    await drainQueues(ctx.app);
    await ctx.app.close();
  });
  beforeEach(async () => {
    await drainQueues(ctx.app);
    await resetDb(ctx.prisma);
    ({ networkId } = await seed(ctx.prisma));
    userToken = (await otpUser(ctx.server, '+224620000001')).token;
    adminToken = await adminUser(ctx.server, ctx.prisma);
  });

  const U = () => ({ Authorization: `Bearer ${userToken}` });
  const A = () => ({ Authorization: `Bearer ${adminToken}` });

  async function ledgerOk() {
    const h = await req(ctx.server).get('/api/v1/admin/system/health').set(A()).expect(200);
    return h.body.ledger.ok;
  }

  it('BUY: quote → order → verified payment → USDT sent → COMPLETED, ledger balanced', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-buy-1')
      .send({ side: 'BUY_USDT', gnfAmount: '1000000' })
      .expect(201);
    expect(quote.body.finalRate).toBe('9270'); // 9000 * 1.03

    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-1')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(201);
    expect(order.body.status).toBe('AWAITING_PAYMENT');

    // USDT reserved
    const t1 = await req(ctx.server).get('/api/v1/admin/treasury').set(A()).expect(200);
    expect(Number(t1.body.balances.USDT.reserved)).toBeGreaterThan(0);

    await req(ctx.server)
      .post(`/api/v1/mock/orange/payment/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);
    await req(ctx.server)
      .post(`/api/v1/mock/crypto/send/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'CONFIRMED' })
      .expect(201);

    const final = await req(ctx.server).get(`/api/v1/crypto/orders/${order.body.id}`).set(U()).expect(200);
    expect(final.body.status).toBe('COMPLETED');
    expect(final.body.events.map((e: any) => e.nextStatus)).toEqual([
      'CREATED',
      'QUOTE_LOCKED',
      'USDT_RESERVED',
      'AWAITING_PAYMENT',
      'PAYMENT_DETECTED',
      'PAYMENT_RECONCILING',
      'PAYMENT_VERIFIED',
      'USDT_PROCESSING',
      'USDT_SENT',
      'COMPLETED',
    ]);
    expect(final.body.cryptoTxHash).toMatch(/^[0-9a-f]{64}$/);

    const t2 = await req(ctx.server).get('/api/v1/admin/treasury').set(A()).expect(200);
    expect(Number(t2.body.balances.USDT.reserved)).toBe(0);
    expect(await ledgerOk()).toBe(true);
  });

  it('SELL: quote → order → deposit confirmed → GNF payout → COMPLETED, ledger balanced', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-sell-1')
      .send({ side: 'SELL_USDT', usdtAmount: '100' })
      .expect(201);

    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/sell')
      .set(U())
      .set('Idempotency-Key', 'o-sell-1')
      .send({ quoteId: quote.body.id, networkId })
      .expect(201);
    expect(order.body.status).toBe('AWAITING_CRYPTO');
    expect(order.body.depositAddress).toMatch(/^T/);

    await req(ctx.server)
      .post(`/api/v1/mock/crypto/deposit/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'CONFIRMED' })
      .expect(201);

    const final = await req(ctx.server).get(`/api/v1/crypto/orders/${order.body.id}`).set(U()).expect(200);
    expect(final.body.status).toBe('COMPLETED');
    expect(final.body.events.map((e: any) => e.nextStatus)).toEqual([
      'CREATED',
      'QUOTE_LOCKED',
      'AWAITING_CRYPTO',
      'CRYPTO_DETECTED',
      'CONFIRMING',
      'CRYPTO_CONFIRMED',
      'GNF_RESERVED',
      'PAYOUT_PENDING',
      'PAYOUT_PROCESSING',
      'COMPLETED',
    ]);
    expect(await ledgerOk()).toBe(true);
  });

  it('BUY failure: PAYMENT_FAILED → FAILED and releases the USDT reservation', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-buy-f')
      .send({ side: 'BUY_USDT', gnfAmount: '1000000' })
      .expect(201);
    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-f')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(201);

    await req(ctx.server)
      .post(`/api/v1/mock/orange/payment/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'PAYMENT_FAILED' })
      .expect(201);

    const final = await req(ctx.server).get(`/api/v1/crypto/orders/${order.body.id}`).set(U()).expect(200);
    expect(final.body.status).toBe('FAILED');
    const t = await req(ctx.server).get('/api/v1/admin/treasury').set(A()).expect(200);
    expect(Number(t.body.balances.USDT.reserved)).toBe(0);
  });

  it('SELL deposit mismatch → UNDER_REVIEW (no GNF paid out)', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-sell-m')
      .send({ side: 'SELL_USDT', usdtAmount: '100' })
      .expect(201);
    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/sell')
      .set(U())
      .set('Idempotency-Key', 'o-sell-m')
      .send({ quoteId: quote.body.id, networkId })
      .expect(201);

    await req(ctx.server)
      .post(`/api/v1/mock/crypto/deposit/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'AMOUNT_MISMATCH' })
      .expect(201);

    const final = await req(ctx.server).get(`/api/v1/crypto/orders/${order.body.id}`).set(U()).expect(200);
    expect(final.body.status).toBe('UNDER_REVIEW');
  });

  it('SELL deposit mismatch UNDER_REVIEW rejects RETRY (deposit never confirmed at quoted amount)', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-sell-m2')
      .send({ side: 'SELL_USDT', usdtAmount: '100' })
      .expect(201);
    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/sell')
      .set(U())
      .set('Idempotency-Key', 'o-sell-m2')
      .send({ quoteId: quote.body.id, networkId })
      .expect(201);
    await req(ctx.server)
      .post(`/api/v1/mock/crypto/deposit/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'AMOUNT_MISMATCH' })
      .expect(201);

    // RETRY must refuse: no `crypto-confirmed` event exists for this order, so
    // resuming would reserve a GNF payout against a deposit that was the wrong amount.
    await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/resolve`)
      .set(A())
      .send({ decision: 'RETRY', reason: 'test' })
      .expect(422);

    // FORCE_COMPLETE must also refuse: no PAID payout exists.
    await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/resolve`)
      .set(A())
      .send({ decision: 'FORCE_COMPLETE', reason: 'test' })
      .expect(422);

    // CANCEL is legal and releases any held reservation.
    const cancelled = await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/resolve`)
      .set(A())
      .send({ decision: 'CANCEL', reason: 'wrong amount deposited' })
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('SELL: liquidity shortfall at GNF reservation flags UNDER_REVIEW, then RETRY completes once liquidity is restored', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-sell-liq')
      .send({ side: 'SELL_USDT', usdtAmount: '100' })
      .expect(201);
    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/sell')
      .set(U())
      .set('Idempotency-Key', 'o-sell-liq')
      .send({ quoteId: quote.body.id, networkId })
      .expect(201);

    // Starve GNF liquidity so the CRYPTO_CONFIRMED -> GNF_RESERVED step fails.
    await ctx.prisma.treasuryAccount.update({
      where: { asset_bucket: { asset: 'GNF', bucket: 'PDV_01' } },
      data: { available: '0' },
    });

    await req(ctx.server)
      .post(`/api/v1/mock/crypto/deposit/${order.body.id}/event`)
      .set(A())
      .send({ scenario: 'CONFIRMED' })
      .expect(201);

    const stuck = await req(ctx.server).get(`/api/v1/crypto/orders/${order.body.id}`).set(U()).expect(200);
    expect(stuck.body.status).toBe('UNDER_REVIEW');

    // Restore liquidity and retry.
    await ctx.prisma.treasuryAccount.update({
      where: { asset_bucket: { asset: 'GNF', bucket: 'PDV_01' } },
      data: { available: '1000000000' },
    });
    const retried = await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/resolve`)
      .set(A())
      .send({ decision: 'RETRY', reason: 'liquidity restored' })
      .expect(201);
    expect(retried.body.status).toBe('COMPLETED');
    expect(await ledgerOk()).toBe(true);

    // Only one GNF reservation was ever created for this order (idempotent resume).
    const reservations = await ctx.prisma.liquidityReservation.count({
      where: { refType: 'crypto_order', refId: order.body.id, asset: 'GNF' },
    });
    expect(reservations).toBe(1);
  });

  it('admin transition endpoint refuses COMPLETED (must go through /resolve)', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-buy-nocomplete')
      .send({ side: 'BUY_USDT', gnfAmount: '1000000' })
      .expect(201);
    const order = await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-nocomplete')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(201);

    await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/transition`)
      .set(A())
      .send({ toStatus: 'COMPLETED', reason: 'nope' })
      .expect(400);

    // CANCELLED is a legal free-form target and releases the USDT reservation.
    const cancelled = await req(ctx.server)
      .post(`/api/v1/admin/crypto/orders/${order.body.id}/transition`)
      .set(A())
      .send({ toStatus: 'CANCELLED', reason: 'user request' })
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    const t = await req(ctx.server).get('/api/v1/admin/treasury').set(A()).expect(200);
    expect(Number(t.body.balances.USDT.reserved)).toBe(0);
  });

  it('rejects a BUY when USDT liquidity is insufficient (409)', async () => {
    await ctx.prisma.treasuryAccount.update({
      where: { asset_bucket: { asset: 'USDT', bucket: 'HOT' } },
      data: { available: '10' },
    });
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-buy-liq')
      .send({ side: 'BUY_USDT', gnfAmount: '1000000' })
      .expect(201);
    await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-liq')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(409);
  });

  it('replays the same order for a repeated buy Idempotency-Key', async () => {
    const quote = await req(ctx.server)
      .post('/api/v1/quotes')
      .set(U())
      .set('Idempotency-Key', 'q-buy-idem')
      .send({ side: 'BUY_USDT', gnfAmount: '1000000' })
      .expect(201);
    const a = await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-idem')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(201);
    const b = await req(ctx.server)
      .post('/api/v1/crypto/orders/buy')
      .set(U())
      .set('Idempotency-Key', 'o-buy-idem')
      .send({ quoteId: quote.body.id, networkId, destinationAddress: TRON })
      .expect(201);
    expect(b.body.id).toBe(a.body.id);
    expect(await ctx.prisma.cryptoOrder.count()).toBe(1);
  });
});


describe('Events — purchase, issuance, QR check-in, settlement', () => {
  let ctx: Ctx;
  let userToken: string;
  let adminToken: string;
  let eventId: string;
  let ticketTypeId: string;

  beforeAll(async () => {
    ctx = await boot();
  });
  afterAll(async () => {
    await drainQueues(ctx.app);
    await ctx.app.close();
  });
  beforeEach(async () => {
    await drainQueues(ctx.app);
    await resetDb(ctx.prisma);
    await seed(ctx.prisma);
    userToken = (await otpUser(ctx.server, '+224620000010')).token;
    adminToken = await adminUser(ctx.server, ctx.prisma);

    const organizerUser = await ctx.prisma.user.create({
      data: { publicUserId: 'U-ORG', phone: '+224611000000', firstName: 'O', lastName: 'R', role: 'ORGANIZER', phoneVerified: true },
    });
    const org = await ctx.prisma.organizer.create({
      data: { userId: organizerUser.id, name: 'Test Prod', slug: 'test-prod', status: 'APPROVED', commissionPct: '0.06', payoutMsisdn: '+224611000000' },
    });
    const ev = await ctx.prisma.event.create({
      data: {
        organizerId: org.id,
        title: 'Test Show',
        slug: 'test-show',
        category: 'CONCERT',
        venue: 'Arena',
        city: 'Conakry',
        eventDate: new Date(Date.now() + 7 * 86400000),
        status: 'PUBLISHED',
      },
    });
    eventId = ev.id;
    const tt = await ctx.prisma.ticketType.create({
      data: { eventId: ev.id, name: 'Standard', priceGnf: '150000', quantity: 3, maxPerOrder: 5 },
    });
    ticketTypeId = tt.id;
  });

  const U = () => ({ Authorization: `Bearer ${userToken}` });
  const A = () => ({ Authorization: `Bearer ${adminToken}` });

  it('buys 2 tickets, issues them on payment, accrues the organizer settlement', async () => {
    const order = await req(ctx.server)
      .post('/api/v1/event-orders')
      .set(U())
      .set('Idempotency-Key', 'evt-0001')
      .send({ eventId, items: [{ ticketTypeId, quantity: 2 }], currency: 'GNF' })
      .expect(201);
    expect(order.body.status).toBe('AWAITING_PAYMENT');

    await req(ctx.server)
      .post(`/api/v1/mock/orange/payment/${order.body.orderId}/event`)
      .set(A())
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);

    const tickets = await req(ctx.server).get('/api/v1/tickets').set(U()).expect(200);
    expect(tickets.body).toHaveLength(2);
    expect(tickets.body[0].qrToken).toBeTruthy();

    const settlements = await req(ctx.server).get('/api/v1/admin/settlements').set(A()).expect(200);
    expect(settlements.body).toHaveLength(1);
    // 2 * 150000 = 300000 gross ; 6% fee = 18000 ; net = 282000
    expect(settlements.body[0].platformFeeGnf).toBe('18000');
    expect(settlements.body[0].organizerNetGnf).toBe('282000');

    const health = await req(ctx.server).get('/api/v1/admin/system/health').set(A()).expect(200);
    expect(health.body.ledger.ok).toBe(true);
  });

  it('first valid scan wins; a second scan is rejected ALREADY_USED', async () => {
    const order = await req(ctx.server)
      .post('/api/v1/event-orders')
      .set(U())
      .set('Idempotency-Key', 'evt-0002')
      .send({ eventId, items: [{ ticketTypeId, quantity: 1 }], currency: 'GNF' })
      .expect(201);
    await req(ctx.server)
      .post(`/api/v1/mock/orange/payment/${order.body.orderId}/event`)
      .set(A())
      .send({ scenario: 'PAYMENT_SUCCESS' })
      .expect(201);
    const tickets = await req(ctx.server).get('/api/v1/tickets').set(U()).expect(200);
    const qr = tickets.body[0].qrToken as string;

    const s1 = await req(ctx.server)
      .post('/api/v1/scanner/scan')
      .set(A())
      .send({ eventId, gate: 'A', qrToken: qr })
      .expect(201);
    expect(s1.body.result).toBe('VALID');

    const s2 = await req(ctx.server)
      .post('/api/v1/scanner/scan')
      .set(A())
      .send({ eventId, gate: 'B', qrToken: qr })
      .expect(201);
    expect(s2.body.result).toBe('ALREADY_USED');
    expect(s2.body.usedGate).toBe('A');
  });

  it('rejects a tampered / invalid QR token', async () => {
    const s = await req(ctx.server)
      .post('/api/v1/scanner/scan')
      .set(A())
      .send({ eventId, gate: 'A', qrToken: 'not-a-real-token.signature' })
      .expect(201);
    expect(s.body.result).toBe('INVALID');
  });

  it('prevents overselling a ticket type (atomic inventory)', async () => {
    // quantity=3 seeded. First order takes 2.
    await req(ctx.server)
      .post('/api/v1/event-orders')
      .set(U())
      .set('Idempotency-Key', 'evt-os-1')
      .send({ eventId, items: [{ ticketTypeId, quantity: 2 }], currency: 'GNF' })
      .expect(201);
    // Second order for 2 more must fail — only 1 left.
    await req(ctx.server)
      .post('/api/v1/event-orders')
      .set(U())
      .set('Idempotency-Key', 'evt-os-2')
      .send({ eventId, items: [{ ticketTypeId, quantity: 2 }], currency: 'GNF' })
      .expect(422);
  });
});
