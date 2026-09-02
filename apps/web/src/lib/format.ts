const gnf = new Intl.NumberFormat('fr-GN', { maximumFractionDigits: 0 });
const usdt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export const fmtGNF = (v: string | number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `${gnf.format(n)} GNF` : `${v}`;
};
export const fmtUSDT = (v: string | number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `${usdt.format(n)} USDT` : `${v}`;
};
export const fmtRate = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${gnf.format(Math.round(n))} GNF/USDT` : v;
};
export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
export const human = (s: string) =>
  s.toLowerCase().split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
