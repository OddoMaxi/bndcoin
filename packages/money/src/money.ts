import Decimal from 'decimal.js';
import { Asset, assetScale } from './assets';

/**
 * Dedicated Decimal constructor. Cloning isolates our configuration from any
 * other decimal.js usage in the process and disables scientific notation so
 * `toFixed()` output is always a plain decimal string safe for Postgres.
 */
const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export type RoundingMode = 'ROUND_DOWN' | 'ROUND_UP' | 'ROUND_HALF_UP';

const ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  ROUND_DOWN: Decimal.ROUND_DOWN,
  ROUND_UP: Decimal.ROUND_UP,
  ROUND_HALF_UP: Decimal.ROUND_HALF_UP,
};

export type Numeric = string | number | bigint | Decimal | Money;

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

/**
 * Coerce an input into a Decimal without ever trusting a JS float. Plain
 * `number` inputs are only accepted when they are safe integers (config values,
 * basis points); anything fractional must arrive as a string so rounding is
 * explicit at the call site.
 */
function toDecimal(value: Numeric): Decimal {
  if (value instanceof Money) return value.decimal;
  if (Decimal.isDecimal(value)) return new D((value as Decimal).toFixed());
  if (typeof value === 'bigint') return new D(value.toString());
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError(
        `Refusing to build Money from the non-integer JS number ${value}; pass a decimal string instead`,
      );
    }
    return new D(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!DECIMAL_STRING.test(trimmed)) {
      throw new MoneyError(`Invalid money string: "${value}"`);
    }
    return new D(trimmed);
  }
  throw new MoneyError(`Unsupported money input of type ${typeof value}`);
}

/** An immutable amount of a single asset, backed by arbitrary-precision Decimal. */
export class Money {
  private readonly value: Decimal;
  readonly asset: Asset;

  private constructor(value: Decimal, asset: Asset) {
    this.value = value;
    this.asset = asset;
  }

  static of(amount: Numeric, asset: Asset): Money {
    return new Money(toDecimal(amount), asset);
  }

  static zero(asset: Asset): Money {
    return new Money(new D(0), asset);
  }

  get decimal(): Decimal {
    return this.value;
  }

  private assertSameAsset(other: Money): void {
    if (other.asset !== this.asset) {
      throw new MoneyError(`Asset mismatch: ${this.asset} vs ${other.asset}`);
    }
  }

  add(other: Money): Money {
    this.assertSameAsset(other);
    return new Money(this.value.plus(other.value), this.asset);
  }

  sub(other: Money): Money {
    this.assertSameAsset(other);
    return new Money(this.value.minus(other.value), this.asset);
  }

  /** Multiply by a dimensionless scalar (e.g. a rate or ratio). Full precision. */
  mul(factor: Numeric): Money {
    return new Money(this.value.times(toDecimal(factor)), this.asset);
  }

  /** Divide by a dimensionless scalar. Full precision; caller quantises. */
  div(divisor: Numeric): Money {
    const d = toDecimal(divisor);
    if (d.isZero()) throw new MoneyError('Division by zero');
    return new Money(this.value.dividedBy(d), this.asset);
  }

  /** Round to the asset's canonical scale. */
  quantize(rounding: RoundingMode = 'ROUND_HALF_UP'): Money {
    const rounded = this.value.toDecimalPlaces(assetScale(this.asset), ROUNDING[rounding]);
    return new Money(rounded, this.asset);
  }

  neg(): Money {
    return new Money(this.value.negated(), this.asset);
  }

  abs(): Money {
    return new Money(this.value.abs(), this.asset);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameAsset(other);
    return this.value.comparedTo(other.value) as -1 | 0 | 1;
  }

  eq(other: Money): boolean {
    return this.compare(other) === 0;
  }
  gt(other: Money): boolean {
    return this.compare(other) === 1;
  }
  gte(other: Money): boolean {
    return this.compare(other) >= 0;
  }
  lt(other: Money): boolean {
    return this.compare(other) === -1;
  }
  lte(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  isZero(): boolean {
    return this.value.isZero();
  }
  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }
  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  assertNonNegative(context = 'amount'): this {
    if (this.isNegative()) {
      throw new MoneyError(`${context} must not be negative (got ${this.toString()})`);
    }
    return this;
  }

  assertPositive(context = 'amount'): this {
    if (!this.isPositive()) {
      throw new MoneyError(`${context} must be strictly positive (got ${this.toString()})`);
    }
    return this;
  }

  /** Canonical decimal string at asset scale. Safe to persist / compare. */
  toString(): string {
    return this.quantize().value.toFixed(assetScale(this.asset));
  }

  /** Full-precision decimal string, no rounding. For intermediate math only. */
  toPreciseString(): string {
    return this.value.toFixed();
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Sum a list of same-asset amounts; empty list requires an explicit asset. */
export function sumMoney(items: Money[], asset?: Asset): Money {
  if (items.length === 0) {
    if (!asset) throw new MoneyError('sumMoney of an empty list needs an explicit asset');
    return Money.zero(asset);
  }
  return items.reduce((acc, m) => acc.add(m));
}
