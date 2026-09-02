'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
export default function P() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { const f = () => api.get('/admin/system/health').then(setD).catch(() => {}); f(); const t = setInterval(f, 5000); return () => clearInterval(t); }, []);
  if (!d) return <p className="text-muted">Chargement…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Santé système</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Modes</h2>
          <pre className="text-xs text-muted">{JSON.stringify(d.mode, null, 2)}</pre>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Services</h2>
          <pre className="text-xs text-muted">{JSON.stringify(d.services, null, 2)}</pre>
          <p className="mt-2 text-sm">Grand livre : <b className={d.ledger.ok ? 'text-forest' : 'text-red-600'}>{d.ledger.ok ? 'OK' : 'DÉSÉQUILIBRE'}</b></p>
          <p className="text-sm">Paiements bloqués &gt;1h : <b>{d.stuckPayments}</b></p>
          <p className="text-sm">Uptime : {Math.floor(d.uptimeSeconds / 60)} min</p>
        </div>
      </div>
      <div className="rounded-xl border border-black/5 bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Modems</h2>
        {d.modems.map((m: any) => <p key={m.name} className="text-sm">{m.name} — <b>{m.status}</b> {m.enabled ? '' : '(désactivé)'}</p>)}
      </div>
    </div>
  );
}
