import Decimal from 'decimal.js';
import { QuoteSide } from '@prisma/client';
import { Money } from '@bn/money';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -40, toExpPos: 40 });

export interface RuleParams {
  spreadAbs: string; // GNF per USDT
  spreadPct: string; // fraction
  feeFixedGnf: string;
  feePct: string; // fraction of gross GNF
}

export interface PriceInputs {
  side: QuoteSide;
  referenceRate: string; // GNF per USDT
  riskBufferBps: number;
  rule: RuleParams;
  gnfAmount?: string;
  usdtAmount?: string;
}

export interface PriceResult {
  finalRate: string;
  spread: string; // total GNF/USDT spread applied
  feesGnf: string;
  grossGnf: string;
  gnfAmount: string;
  usdtAmount: string;
}

export function effectiveRate(side: QuoteSide, referenceRate: string, riskBufferBps: number, rule: RuleParams): {
  finalRate: string;
  spread: string;
} {
  const ref = new D(referenceRate);
  const buffer = ref.times(new D(riskBufferBps).dividedBy(10_000));
  const pctPart = ref.times(new D(rule.spreadPct));
  const absPart = new D(rule.spreadAbs);
  const totalSpread = pctPart.plus(absPart).plus(buffer);
  const finalRate = side === 'BUY_USDT' ? ref.plus(totalSpread) : ref.minus(totalSpread);
  if (finalRate.lte(0)) throw new Error('Computed final rate is not positive; spread too large');
  return { finalRate: finalRate.toFixed(), spread: totalSpread.toFixed() };
}

export function computePrice(inputs: PriceInputs): PriceResult {
  const { finalRate, spread } = effectiveRate(inputs.side, inputs.referenceRate, inputs.riskBufferBps, inputs.rule);
  const rate = new D(finalRate);
  const feeFixed = new D(inputs.rule.feeFixedGnf);
  const feePct = new D(inputs.rule.feePct);

  if (inputs.side === 'BUY_USDT') {
    let gnf: Decimal;
    let usdt: Decimal;
    if (inputs.gnfAmount) {
      gnf = new D(inputs.gnfAmount);
      const fees = feeFixed.plus(gnf.times(feePct));
      const convertible = gnf.minus(fees);
      if (convertible.lte(0)) throw new Error('Amount too small after fees');
      usdt = convertible.dividedBy(rate).toDecimalPlaces(6, Decimal.ROUND_DOWN);
      return finalize({ finalRate, spread, feesGnf: fees, grossGnf: gnf, gnf, usdt });
    }
    usdt = new D(inputs.usdtAmount!).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    const base = usdt.times(rate);
    // fees are a fraction of gnf; solve gnf = base + feeFixed + feePct*gnf
    const gnfBefore = base.plus(feeFixed).dividedBy(new D(1).minus(feePct));
    gnf = gnfBefore.toDecimalPlaces(0, Decimal.ROUND_UP);
    const fees = gnf.minus(base);
    return finalize({ finalRate, spread, feesGnf: fees, grossGnf: gnf, gnf, usdt });
  }

  // SELL_USDT
  let usdt: Decimal;
  let gnf: Decimal;
  if (inputs.usdtAmount) {
    usdt = new D(inputs.usdtAmount).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    const gross = usdt.times(rate);
    const fees = feeFixed.plus(gross.times(feePct));
    gnf = gross.minus(fees).toDecimalPlaces(0, Decimal.ROUND_DOWN);
    if (gnf.lte(0)) throw new Error('Amount too small after fees');
    return finalize({ finalRate, spread, feesGnf: fees, grossGnf: gross, gnf, usdt });
  }
  gnf = new D(inputs.gnfAmount!).toDecimalPlaces(0, Decimal.ROUND_DOWN);
  // gnf = gross - feeFixed - feePct*gross  => gross = (gnf + feeFixed) / (1 - feePct)
  const gross = gnf.plus(feeFixed).dividedBy(new D(1).minus(feePct));
  usdt = gross.dividedBy(rate).toDecimalPlaces(6, Decimal.ROUND_UP);
  const fees = gross.minus(gnf);
  return finalize({ finalRate, spread, feesGnf: fees, grossGnf: gross, gnf, usdt });
}

function finalize(p: {
  finalRate: string;
  spread: string;
  feesGnf: Decimal;
  grossGnf: Decimal;
  gnf: Decimal;
  usdt: Decimal;
}): PriceResult {
  return {
    finalRate: p.finalRate,
    spread: p.spread,
    feesGnf: Money.of(p.feesGnf.toFixed(), 'GNF').toString(),
    grossGnf: Money.of(p.grossGnf.toFixed(), 'GNF').toString(),
    gnfAmount: Money.of(p.gnf.toFixed(), 'GNF').toString(),
    usdtAmount: Money.of(p.usdt.toFixed(), 'USDT').toString(),
  };
}
