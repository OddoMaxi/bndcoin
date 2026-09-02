'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
export default function P() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get('/admin/treasury/ledger').then(setD).catch(() => {}); }, []);
  if (!d) return <p className="text-muted">Chargement…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Grand livre — balance</h1>
      <p className={`text-sm font-semibold ${d.integrity.ok ? 'text-forest' : 'text-red-600'}`}>
        Intégrité double-entrée : {d.integrity.ok ? 'ÉQUILIBRÉ' : 'DÉSÉQUILIBRE'} — {JSON.stringify(d.integrity.perCurrency)}
      </p>
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted"><tr><th className="px-3 py-2">Compte</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Devise</th><th className="px-3 py-2 text-right">Solde</th></tr></thead>
          <tbody>{d.trialBalance.map((a: any) => (
            <tr key={a.code} className="border-t border-black/5"><td className="px-3 py-2 font-mono text-xs">{a.code}</td><td className="px-3 py-2">{a.type}</td><td className="px-3 py-2">{a.currency}</td><td className="px-3 py-2 text-right font-medium">{Number(a.balance).toLocaleString('fr-FR')}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
