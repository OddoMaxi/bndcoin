import { Prisma } from '@prisma/client';
import { Asset, Money } from '@bn/money';

type DecimalLike = Prisma.Decimal | string | number;

/** Full-precision decimal string from any Prisma Decimal / primitive. */
export function decimalToString(value: DecimalLike): string {
  if (value instanceof Prisma.Decimal) return value.toFixed();
  return String(value);
}

/** Canonical, asset-scaled money string suitable for API responses. */
export function toMoneyString(value: DecimalLike, asset: Asset): string {
  return Money.of(decimalToString(value), asset).toString();
}
