'use client';
import { useEffect, useState } from 'react';
import { api, newKey } from '@/lib/api-client';
import { fmtGNF, fmtUSDT } from '@/lib/format';
export default function P() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState({ asset: 'USDT', bucket: 'HOT', direction: 'CREDIT', amount: '', memo: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => api.get('/admin/treasury').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <p className="text-muted">Chargement…</p>;
  const b = d.balances;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Trésorerie</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {['GNF', 'USDT'].map((a) => (
          <div key={a} className="rounded-xl border border-black/5 bg-surface p-4">
            <p className="text-xs text-muted">{a}</p>
            <p className="text-lg font-bold text-forest">{a === 'GNF' ? fmtGNF(b[a].available) : fmtUSDT(b[a].available)}</p>
            <p className="text-xs text-muted">réservé {a === 'GNF' ? fmtGNF(b[a].reserved) : fmtUSDT(b[a].reserved)}</p>
            <div className="mt-2 space-y-0.5 text-xs">
              {b[a].buckets.map((k: any) => <div key={k.bucket} className="flex justify-between"><span>{k.bucket}</span><span>{k.available}</span></div>)}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-black/5 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Réconciliation trésorerie ↔ grand livre</h2>
        <pre className="text-xs text-muted">{JSON.stringify(d.reconcile, null, 2)}</pre>
      </div>
      <form className="rounded-xl border border-black/5 bg-surface p-4 space-y-2" onSubmit={async (e) => {
        e.preventDefault(); setMsg(null);
        try { await api.post('/admin/treasury/adjust', f, { idempotencyKey: newKey() }); setF({ ...f, amount: '', memo: '' }); load(); }
        catch (err) { setMsg((err as Error).message); }
      }}>
        <h2 className="text-sm font-semibold">Ajustement manuel</h2>
        <div className="grid grid-cols-3 gap-2">
          <select className="field" value={f.asset} onChange={(e) => setF({ ...f, asset: e.target.value })}><option>USDT</option><option>GNF</option></select>
          <select className="field" value={f.bucket} onChange={(e) => setF({ ...f, bucket: e.target.value })}><option>MAIN</option><option>HOT</option><option>COLD</option><option>PDV_01</option><option>PDV_02</option></select>
          <select className="field" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option>CREDIT</option><option>DEBIT</option></select>
        </div>
        <input className="field" placeholder="Montant" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input className="field" placeholder="Note" value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full">Appliquer</button>
      </form>
    </div>
  );
}
