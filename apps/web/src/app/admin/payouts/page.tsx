'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { StatusPill } from '@/components/ui';
import { fmtGNF } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Versements GNF" url="/admin/payouts" intervalMs={6000}
      columns={[
        { key: 'publicId', label: 'Réf', render: (r) => <span className="font-mono text-xs">{r.publicId}</span> },
        { key: 'refType', label: 'Objet' },
        { key: 'toPhone', label: 'Vers' },
        { key: 'amount', label: 'Montant', render: (r) => fmtGNF(r.amount) },
        { key: 'status', label: 'Statut', render: (r) => <StatusPill status={r.status} /> },
        { key: 'attempts', label: 'Essais' },
      ]}
      actions={(r, reload) => ['FAILED', 'UNDER_REVIEW'].includes(r.status) ? (
        <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/payouts/${r.id}/retry`); if (e) alert(e); reload(); }}>Relancer</button>
      ) : null}
    />
  );
}
