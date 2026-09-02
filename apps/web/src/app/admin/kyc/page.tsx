'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { human } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Vérifications KYC" url="/admin/kyc?pageSize=50"
      columns={[
        { key: 'userName', label: 'Client' },
        { key: 'phone', label: 'Téléphone' },
        { key: 'documentType', label: 'Document' },
        { key: 'documentNumber', label: 'N°' },
        { key: 'status', label: 'Statut', render: (r) => human(r.status) },
      ]}
      actions={(r, reload) => r.status === 'PENDING' ? (
        <div className="flex justify-end gap-1">
          <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/kyc/${r.id}/review`, { decision: 'VERIFIED', reason: 'documents OK' }); if (e) alert(e); reload(); }}>Approuver</button>
          <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/kyc/${r.id}/review`, { decision: 'REJECTED', reason: 'documents incomplets' }); if (e) alert(e); reload(); }}>Rejeter</button>
        </div>
      ) : null}
    />
  );
}
