'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { StatusPill } from '@/components/ui';
import { fmtGNF } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Paiements Orange Money" url="/admin/payments" intervalMs={6000}
      columns={[
        { key: 'publicId', label: 'Réf', render: (r) => <span className="font-mono text-xs">{r.publicId}</span> },
        { key: 'refType', label: 'Objet' },
        { key: 'amount', label: 'Montant', render: (r) => fmtGNF(r.amount) },
        { key: 'status', label: 'Statut', render: (r) => <StatusPill status={r.status} /> },
        { key: 'externalReference', label: 'Réf. rail', render: (r) => <span className="font-mono text-[11px]">{r.externalReference || '—'}</span> },
      ]}
      actions={(r, reload) => r.status === 'UNDER_REVIEW' ? (
        <div className="flex justify-end gap-1">
          <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/payments/${r.id}/resolve`, { decision: 'VERIFY', reason: 'manual review' }); if (e) alert(e); reload(); }}>Valider</button>
          <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/payments/${r.id}/resolve`, { decision: 'REJECT', reason: 'manual review' }); if (e) alert(e); reload(); }}>Rejeter</button>
        </div>
      ) : null}
    />
  );
}
