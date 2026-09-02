'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { human } from '@/lib/format';
const ROLES = ['CUSTOMER', 'OPERATIONS', 'TREASURY', 'COMPLIANCE', 'FINANCE', 'EVENT_MANAGER', 'SCANNER_OPERATOR', 'ORGANIZER', 'AUDITOR', 'SUPER_ADMIN'];
export default function P() {
  return (
    <AdminTable title="Utilisateurs" url="/admin/users?pageSize=50"
      columns={[
        { key: 'publicUserId', label: 'ID', render: (r) => <span className="font-mono text-xs">{r.publicUserId}</span> },
        { key: 'name', label: 'Nom', render: (r) => `${r.firstName} ${r.lastName}` },
        { key: 'phone', label: 'Téléphone' },
        { key: 'role', label: 'Rôle', render: (r) => human(r.role) },
        { key: 'kycStatus', label: 'KYC', render: (r) => human(r.kycStatus) },
        { key: 'status', label: 'Statut', render: (r) => human(r.status) },
      ]}
      actions={(r, reload) => (
        <select className="field !w-auto !py-1 text-xs" defaultValue={r.role} onChange={async (e) => { const err = await adminAction(`/admin/users/${r.id}`, { role: e.target.value }); if (err) alert(err); reload(); }}>
          {ROLES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      )}
    />
  );
}
