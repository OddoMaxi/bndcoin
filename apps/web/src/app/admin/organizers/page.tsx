'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
export default function P() {
  return (
    <AdminTable title="Organisateurs" url="/admin/organizers"
      columns={[
        { key: 'name', label: 'Nom' },
        { key: 'contact', label: 'Contact', render: (r) => `${r.user?.firstName ?? ''} ${r.user?.phone ?? ''}` },
        { key: 'status', label: 'Statut' },
        { key: 'commissionPct', label: 'Commission', render: (r) => `${(Number(r.commissionPct) * 100).toFixed(1)}%` },
      ]}
      actions={(r, reload) => r.status !== 'APPROVED' ? (
        <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/organizers/${r.id}/status`, { status: 'APPROVED' }); if (e) alert(e); reload(); }}>Approuver</button>
      ) : <button className="rounded bg-black/10 px-2 py-1 text-xs" onClick={async () => { await adminAction(`/admin/organizers/${r.id}/status`, { status: 'SUSPENDED' }); reload(); }}>Suspendre</button>}
    />
  );
}
