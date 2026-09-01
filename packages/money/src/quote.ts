import Decimal from 'decimal.js';
import { assetScale } from './assets';
import { Money } from './money';

const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

const BPS_DIVISOR = new D(10_000);

export interface BuyQuoteInput {
  /** Whole GNF the client commits to pay. */
  gnfAmount: string;
  /** Mid-market GNF per 1 USDT. */
  marketRate: string;
  /** B&N margin in basis points, marked up on the market rate for a BUY. */
  buySpreadBps: number;
  /** Optional flat GNF fee deducted from the GNF amount before conversion. */
  feeGnfFlat?: string;
}

export interface BuyQuoteResult {
  marketRate: string;
  /** GNF per 1 USDT actually applied to the client (market + spread). */
  bnRate: string;
  spreadBps: number;
  feeGnf: string;
  gnfAmount: string;
  /** gnfAmount - feeGnf, i.e. the GNF that gets converted. */
  gnfConverted: string;
  /** USDT credited to the client, rounded DOWN so we never over-send. */
  usdtAmount: string;
}

/** GNF per 1 USDT for a BUY: market rate marked up by the spread. */
export function computeBuyRate(marketRate: string, buySpreadBps: number): string {
  if (!Number.isInteger(buySpreadBps) || buySpreadBps < 0) {
    throw new Error(`buySpreadBps must be a non-negative integer (got ${buySpreadBps})`);
  }
  const factor = new D(1).plus(new D(buySpreadBps).dividedBy(BPS_DIVISOR));
  return new D(marketRate).times(factor).toFixed();
}

/**
 * Deterministic BUY pricing. All arithmetic is Decimal; the USDT result is
 * rounded DOWN to the token scale so the platform never credits a fraction more
 * than the client paid for.
 */
export function computeBuyQuote(input: BuyQuoteInput): BuyQuoteResult {
  const gnfAmount = Money.of(input.gnfAmount, 'GNF').assertPositive('gnfAmount').quantize();
  const feeGnf = Money.of(input.feeGnfFlat ?? '0', 'GNF').assertNonNegative('feeGnfFlat').quantize();

  const gnfConverted = gnfAmount.sub(feeGnf);
  gnfConverted.assertPositive('gnfAmount after fee');

  const bnRate = computeBuyRate(input.marketRate, input.buySpreadBps);

  const usdt = new D(gnfConverted.toPreciseString())
    .dividedBy(new D(bnRate))
    .toDecimalPlaces(assetScale('USDT'), Decimal.ROUND_DOWN)
    .toFixed(assetScale('USDT'));

  return {
    marketRate: new D(input.marketRate).toFixed(),
    bnRate,
    spreadBps: input.buySpreadBps,
    feeGnf: feeGnf.toString(),
    gnfAmount: gnfAmount.toString(),
    gnfConverted: gnfConverted.toString(),
    usdtAmount: usdt,
  };
}

export interface AmountRange {
  min: string;
  max: string;
}

export function assertGnfWithinRange(gnfAmount: string, range: AmountRange): void {
  const amount = Money.of(gnfAmount, 'GNF');
  if (amount.lt(Money.of(range.min, 'GNF'))) {
    throw new Error(`Amount ${amount.toString()} GNF is below the minimum ${range.min} GNF`);
  }
  if (amount.gt(Money.of(range.max, 'GNF'))) {
    throw new Error(`Amount ${amount.toString()} GNF is above the maximum ${range.max} GNF`);
  }
}
