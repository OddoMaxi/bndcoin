'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { StatusPill } from '@/components/ui';
import { fmtDate } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Réconciliation" url="/admin/reconciliation/open" intervalMs={6000}
      columns={[
        { key: 'kind', label: 'Type' },
        { key: 'status', label: 'Statut', render: (r) => <StatusPill status={r.status} /> },
        { key: 'expectedAmount', label: 'Attendu' },
        { key: 'observedAmount', label: 'Observé' },
        { key: 'mismatchReason', label: 'Motif', render: (r) => r.mismatchReason || '—' },
        { key: 'createdAt', label: 'Créé', render: (r) => fmtDate(r.createdAt) },
      ]}
      actions={(r, reload) => r.intentId ? (
        <div className="flex justify-end gap-1">
          <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/reconciliation/payment/${r.intentId}/resolve`, { decision: 'VERIFY', reason: 'reconciled manually' }); if (e) alert(e); reload(); }}>Valider</button>
          <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/reconciliation/payment/${r.intentId}/resolve`, { decision: 'REJECT', reason: 'rejected manually' }); if (e) alert(e); reload(); }}>Rejeter</button>
        </div>
      ) : null}
    />
  );
}
