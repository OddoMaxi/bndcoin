'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { fmtGNF } from '@/lib/format';
export default function P() {
  const [d, setD] = useState<any>(null);
  const load = () => api.get('/admin/orange/control-centre').then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  if (!d) return <p className="text-muted">Chargement…</p>;
  const act = async (id: string, action: string) => { await api.post(`/admin/orange/modems/${id}/action`, { action }); load(); };
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Centre de contrôle Orange Money</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(d.payments).map(([k, v]) => <span key={k} className="rounded-lg bg-black/[0.04] px-2 py-1">Paiements {k}: <b>{v as number}</b></span>)}
        {Object.entries(d.payouts).map(([k, v]) => <span key={k} className="rounded-lg bg-black/[0.04] px-2 py-1">Versements {k}: <b>{v as number}</b></span>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {d.modems.map((m: any) => (
          <div key={m.id} className="rounded-xl border border-black/5 bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{m.name}</span>
              <span className={`pill ${m.status === 'ONLINE' || m.status === 'AVAILABLE' ? 'bg-forest-tint text-forest' : m.status === 'BUSY' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted">SIM {m.sim?.msisdn} · solde {fmtGNF(m.balanceGnf)}</p>
            <p className="text-xs text-muted">Aujourd’hui : {m.dailyTxCount} tx / {fmtGNF(m.dailyVolumeGnf)} · jobs actifs {m.activeJobs} · échecs récents {m.recentFailures}</p>
            {m.lastError && <p className="text-xs text-red-600">Dernière erreur : {m.lastError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={() => act(m.id, 'ENABLE')}>Activer</button>
              <button className="rounded bg-black/10 px-2 py-1 text-xs" onClick={() => act(m.id, 'DISABLE')}>Désactiver</button>
              <button className="rounded bg-amber-500 px-2 py-1 text-xs text-white" onClick={() => act(m.id, 'MAINTENANCE')}>Maintenance</button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-ghost" onClick={async () => { await api.post('/admin/orange/healthcheck'); load(); }}>Lancer un healthcheck</button>
    </div>
  );
}
