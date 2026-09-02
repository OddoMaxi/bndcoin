'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { fmtGNF, fmtUSDT, human } from '@/lib/format';

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.get('/admin/dashboard').then(setD).catch((e) => setErr(e.message));
    const t = setInterval(() => api.get('/admin/dashboard').then(setD).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!d) return <p className="text-muted">Chargement…</p>;

  const stat = (label: string, value: React.ReactNode, sub?: string) => (
    <div className="rounded-xl border border-black/5 bg-surface p-4">
      <p className="text-2xl font-bold text-forest">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat('Utilisateurs', d.users.total, `${d.users.kycPending} KYC en attente`)}
        {stat('Volume crypto 24h', fmtGNF(d.crypto.today.volumeGnf), `${d.crypto.today.count} ordres`)}
        {stat('Revenu plateforme', fmtGNF(d.finance.platformRevenueGnf))}
        {stat('Alertes ouvertes', d.alerts.open)}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Trésorerie</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>GNF disponible</span>
              <span className="font-medium">{fmtGNF(d.treasury.gnf.available)}</span>
            </div>
            <div className="flex justify-between">
              <span>USDT disponible</span>
              <span className="font-medium">{fmtUSDT(d.treasury.usdt.available)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>USDT réservé</span>
              <span>{fmtUSDT(d.treasury.usdt.reserved)}</span>
            </div>
            <div className="mt-2 border-t border-black/5 pt-2">
              <div className="flex justify-between">
                <span>Coût moyen USDT (WAC)</span>
                <span>{fmtGNF(d.treasury.inventory.weightedAverageCostGnf)}</span>
              </div>
              <div className="flex justify-between">
                <span>Marge réalisée</span>
                <span>{fmtGNF(d.treasury.inventory.realizedMarginGnf)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Opérations</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Paiements en attente</span>
              <span>{d.operations.pendingPayments}</span>
            </div>
            <div className="flex justify-between">
              <span>Versements en attente</span>
              <span>{d.operations.pendingPayouts}</span>
            </div>
            <div className="flex justify-between">
              <span>Transactions en échec / revue</span>
              <span>{d.operations.failedTransactions}</span>
            </div>
            <div className="mt-2 border-t border-black/5 pt-2">
              <div className="flex justify-between">
                <span>Grand livre équilibré</span>
                <span className={d.finance.ledgerBalanced ? 'font-semibold text-forest' : 'font-semibold text-red-600'}>
                  {d.finance.ledgerBalanced ? 'Oui' : 'NON'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Ordres crypto par statut</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(d.crypto.byStatus).map(([k, v]) => (
            <span key={k} className="rounded-lg bg-black/[0.04] px-2 py-1">
              {human(k)}: <b>{v as number}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stat('Événements actifs', d.events.active)}
        {stat('Billets vendus', d.events.ticketsSold)}
        {stat('Check-ins', d.events.checkins)}
      </div>
    </div>
  );
}
