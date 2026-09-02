import { computePrice, effectiveRate } from './pricing.math';

const NO_FEE = { spreadAbs: '0', spreadPct: '0', feeFixedGnf: '0', feePct: '0' };

describe('pricing math', () => {
  it('marks the rate up for BUY and down for SELL by the spread', () => {
    const buy = effectiveRate('BUY_USDT', '9000', 0, { ...NO_FEE, spreadPct: '0.03' });
    const sell = effectiveRate('SELL_USDT', '9000', 0, { ...NO_FEE, spreadPct: '0.03' });
    expect(buy.finalRate).toBe('9270');
    expect(sell.finalRate).toBe('8730');
  });

  it('adds the risk buffer on top of the spread', () => {
    const { finalRate } = effectiveRate('BUY_USDT', '9000', 100, { ...NO_FEE, spreadPct: '0.02' });
    // 9000 + 9000*0.02 + 9000*0.01
    expect(finalRate).toBe('9270');
  });

  it('BUY from a GNF amount never over-credits USDT (rounds down)', () => {
    const r = computePrice({
      side: 'BUY_USDT',
      referenceRate: '9000',
      riskBufferBps: 0,
      rule: { ...NO_FEE, spreadPct: '0.03', feePct: '0.005' },
      gnfAmount: '1000000',
    });
    // fees = 5000, convertible 995000, rate 9270 -> 107.335...
    expect(r.feesGnf).toBe('5000');
    expect(r.usdtAmount).toBe('107.335490');
    expect(Number(r.usdtAmount) * 9270 + 5000).toBeLessThanOrEqual(1000000);
  });

  it('SELL from a USDT amount deducts the fee from the GNF proceeds', () => {
    const r = computePrice({
      side: 'SELL_USDT',
      referenceRate: '9000',
      riskBufferBps: 0,
      rule: { ...NO_FEE, spreadPct: '0.03', feeFixedGnf: '2000', feePct: '0.004' },
      usdtAmount: '500',
    });
    // gross = 500 * 8730 = 4,365,000 ; fee = 2000 + 17460 = 19460 ; net = 4,345,540
    expect(r.grossGnf).toBe('4365000');
    expect(r.feesGnf).toBe('19460');
    expect(r.gnfAmount).toBe('4345540');
  });

  it('rejects a spread that would push the rate to zero or below', () => {
    expect(() => effectiveRate('SELL_USDT', '9000', 0, { ...NO_FEE, spreadPct: '1.2' })).toThrow();
  });
});
