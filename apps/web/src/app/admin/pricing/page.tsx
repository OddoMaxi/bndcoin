'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
export default function P() {
  const [cfg, setCfg] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [c, setC] = useState({ referenceRate: '', riskBufferBps: 50 });
  const load = () => { api.get('/admin/pricing/config').then((x: any) => { setCfg(x); setC({ referenceRate: String(x.referenceRate), riskBufferBps: x.riskBufferBps }); }); api.get<any[]>('/admin/pricing/rules').then(setRules); };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Tarification</h1>
      <form className="rounded-xl border border-black/5 bg-surface p-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); await api.put('/admin/pricing/config', c); load(); }}>
        <h2 className="text-sm font-semibold">Configuration (v{cfg?.version})</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Taux de référence (GNF/USDT)<input className="field" value={c.referenceRate} onChange={(e) => setC({ ...c, referenceRate: e.target.value })} /></label>
          <label className="text-xs text-muted">Risk buffer (bps)<input className="field" type="number" value={c.riskBufferBps} onChange={(e) => setC({ ...c, riskBufferBps: Number(e.target.value) })} /></label>
        </div>
        <button className="btn-primary w-full">Publier une nouvelle version</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted"><tr><th className="px-3 py-2">Sens</th><th className="px-3 py-2">Palier USDT</th><th className="px-3 py-2">Spread %</th><th className="px-3 py-2">Frais %</th><th className="px-3 py-2">Priorité</th><th className="px-3 py-2">Actif</th></tr></thead>
          <tbody>{rules.map((r) => (
            <tr key={r.id} className="border-t border-black/5"><td className="px-3 py-2">{r.side}</td><td className="px-3 py-2">{r.minUsdt} – {r.maxUsdt ?? '∞'}</td><td className="px-3 py-2">{(Number(r.spreadPct) * 100).toFixed(2)}%</td><td className="px-3 py-2">{(Number(r.feePct) * 100).toFixed(2)}%</td><td className="px-3 py-2">{r.priority}</td><td className="px-3 py-2">{r.active ? '✓' : '—'}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
