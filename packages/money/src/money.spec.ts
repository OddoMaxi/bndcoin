import { Money, MoneyError, sumMoney } from './money';
import { computeBuyQuote, computeBuyRate, assertGnfWithinRange } from './quote';

describe('Money', () => {
  it('rejects non-integer JS number inputs to keep floats out of the domain', () => {
    expect(() => Money.of(0.1 + 0.2, 'USDT')).toThrow(MoneyError);
    expect(() => Money.of(1.5, 'GNF')).toThrow(MoneyError);
  });

  it('accepts safe-integer numbers and decimal strings', () => {
    expect(Money.of(1_000_000, 'GNF').toString()).toBe('1000000');
    expect(Money.of('12.345678', 'USDT').toString()).toBe('12.345678');
  });

  it('quantises to asset scale (GNF=0, USDT=6)', () => {
    expect(Money.of('10.9', 'GNF').toString()).toBe('11');
    expect(Money.of('0.1234565', 'USDT').quantize('ROUND_DOWN').toString()).toBe('0.123456');
  });

  it('does not drift over repeated addition (no binary float error)', () => {
    let acc = Money.zero('USDT');
    for (let i = 0; i < 1000; i++) acc = acc.add(Money.of('0.000001', 'USDT'));
    expect(acc.toString()).toBe('0.001000');
  });

  it('adds a large GNF ledger exactly', () => {
    const total = sumMoney(
      Array.from({ length: 2000 }, () => Money.of('999999999', 'GNF')),
    );
    expect(total.toString()).toBe('1999999998000');
  });

  it('guards asset mismatches and division by zero', () => {
    expect(() => Money.of('1', 'GNF').add(Money.of('1', 'USDT') as never)).toThrow(MoneyError);
    expect(() => Money.of('1', 'USDT').div('0')).toThrow(MoneyError);
  });

  it('assertNonNegative / assertPositive behave at the boundary', () => {
    expect(Money.zero('GNF').assertNonNegative().toString()).toBe('0');
    expect(() => Money.zero('GNF').assertPositive()).toThrow(MoneyError);
    expect(() => Money.of('-1', 'GNF').assertNonNegative()).toThrow(MoneyError);
  });
});

describe('computeBuyRate', () => {
  it('marks the market rate up by the spread', () => {
    expect(computeBuyRate('8600', 250)).toBe('8815'); // +2.5%
    expect(computeBuyRate('8600', 0)).toBe('8600');
  });
});

describe('computeBuyQuote', () => {
  it('computes a deterministic BUY quote and never over-credits USDT', () => {
    const q = computeBuyQuote({ gnfAmount: '1000000', marketRate: '8600', buySpreadBps: 250 });
    expect(q.bnRate).toBe('8815');
    expect(q.gnfConverted).toBe('1000000');
    // 1_000_000 / 8815 = 113.4429948...  -> rounded DOWN to 6dp
    expect(q.usdtAmount).toBe('113.442994');
  });

  it('applies a flat GNF fee before conversion', () => {
    const q = computeBuyQuote({
      gnfAmount: '1000000',
      marketRate: '8600',
      buySpreadBps: 250,
      feeGnfFlat: '5000',
    });
    expect(q.feeGnf).toBe('5000');
    expect(q.gnfConverted).toBe('995000');
  });

  it('rejects amounts that would convert to nothing', () => {
    expect(() =>
      computeBuyQuote({ gnfAmount: '1000', marketRate: '8600', buySpreadBps: 0, feeGnfFlat: '1000' }),
    ).toThrow();
  });
});

describe('assertGnfWithinRange', () => {
  it('accepts inside the range and rejects outside', () => {
    expect(() => assertGnfWithinRange('1000000', { min: '50000', max: '50000000' })).not.toThrow();
    expect(() => assertGnfWithinRange('1000', { min: '50000', max: '50000000' })).toThrow();
    expect(() => assertGnfWithinRange('60000000', { min: '50000', max: '50000000' })).toThrow();
  });
});
