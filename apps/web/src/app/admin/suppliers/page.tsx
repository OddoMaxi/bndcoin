'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { fmtGNF, fmtUSDT } from '@/lib/format';
export default function P() {
  const [sup, setSup] = useState<any[]>([]);
  const [pur, setPur] = useState<any[]>([]);
  const [inv, setInv] = useState<any>(null);
  const [f, setF] = useState({ name: '', phone: '' });
  const [pf, setPf] = useState({ supplierId: '', quantityUsdt: '', purchaseAmount: '' });
  const load = () => {
    api.get<any[]>('/admin/suppliers').then(setSup);
    api.get<any[]>('/admin/suppliers/purchases').then(setPur);
    api.get('/admin/suppliers/inventory').then(setInv);
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Fournisseurs USDT</h1>
      {inv && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['USDT en stock', fmtUSDT(inv.quantityRemainingUsdt)], ['Coût moyen (WAC)', fmtGNF(inv.weightedAverageCostGnf)], ['Valorisation stock', fmtGNF(inv.inventoryValuationGnf)], ['Marge réalisée', fmtGNF(inv.realizedMarginGnf)]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-black/5 bg-surface p-3"><p className="text-sm font-bold text-forest">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <form className="rounded-xl border border-black/5 bg-surface p-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); await api.post('/admin/suppliers', f); setF({ name: '', phone: '' }); load(); }}>
          <h2 className="text-sm font-semibold">Nouveau fournisseur</h2>
          <input className="field" placeholder="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className="field" placeholder="Téléphone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <button className="btn-primary w-full">Créer</button>
        </form>
        <form className="rounded-xl border border-black/5 bg-surface p-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); await api.post('/admin/suppliers/purchases', pf); setPf({ supplierId: '', quantityUsdt: '', purchaseAmount: '' }); load(); }}>
          <h2 className="text-sm font-semibold">Nouvel approvisionnement</h2>
          <select className="field" value={pf.supplierId} onChange={(e) => setPf({ ...pf, supplierId: e.target.value })} required><option value="">— fournisseur —</option>{sup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className="field" placeholder="Quantité USDT" value={pf.quantityUsdt} onChange={(e) => setPf({ ...pf, quantityUsdt: e.target.value })} required />
          <input className="field" placeholder="Montant payé (GNF)" value={pf.purchaseAmount} onChange={(e) => setPf({ ...pf, purchaseAmount: e.target.value })} required />
          <button className="btn-primary w-full">Enregistrer</button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted"><tr><th className="px-3 py-2">Réf</th><th className="px-3 py-2">Fournisseur</th><th className="px-3 py-2">USDT</th><th className="px-3 py-2">Coût unit.</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{pur.map((p) => (
            <tr key={p.id} className="border-t border-black/5">
              <td className="px-3 py-2 font-mono text-xs">{p.publicId}</td>
              <td className="px-3 py-2">{p.supplier?.name}</td>
              <td className="px-3 py-2">{fmtUSDT(p.quantityUsdt)}</td>
              <td className="px-3 py-2">{fmtGNF(p.unitCostGnf)}</td>
              <td className="px-3 py-2">{p.status}</td>
              <td className="px-3 py-2 text-right">{p.status === 'PENDING' && (
                <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { await api.post(`/admin/suppliers/purchases/${p.id}/status`, { status: 'CONFIRMED' }); load(); }}>Confirmer</button>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
