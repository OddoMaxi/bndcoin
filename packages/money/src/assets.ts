/**
 * Assets handled by the platform and their canonical on-ledger precision.
 *
 * GNF (Guinean Franc) has no circulating minor unit — amounts are whole francs.
 * USDT is stored at 6 decimals, matching the TRON/most-EVM token contracts.
 *
 * Every amount persisted to Postgres is quantised to the asset scale before it
 * leaves the domain layer, so the database DECIMAL columns never carry more
 * precision than the asset actually supports.
 */
export type Asset = 'GNF' | 'USDT';

export const ASSETS: readonly Asset[] = ['GNF', 'USDT'] as const;

export const ASSET_SCALE: Record<Asset, number> = {
  GNF: 0,
  USDT: 6,
};

export function isAsset(value: unknown): value is Asset {
  return value === 'GNF' || value === 'USDT';
}

export function assetScale(asset: Asset): number {
  const scale = ASSET_SCALE[asset];
  if (scale === undefined) {
    throw new Error(`Unknown asset: ${String(asset)}`);
  }
  return scale;
}
