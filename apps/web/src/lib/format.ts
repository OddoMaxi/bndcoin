/**
 * Formatting only. The API sends money as canonical decimal strings; we never
 * do arithmetic on them here, only presentation.
 */

const gnfFmt = new Intl.NumberFormat('fr-GN', { maximumFractionDigits: 0 });
const usdtFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatGNF(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${value}`;
  return `${gnfFmt.format(n)} GNF`;
}

export function formatUSDT(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${value}`;
  return `${usdtFmt.format(n)} USDT`;
}

export function formatRate(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${gnfFmt.format(Math.round(n))} GNF / USDT` : value;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function humanStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
