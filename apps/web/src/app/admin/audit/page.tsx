'use client';
import { AdminTable } from '@/components/AdminTable';
import { fmtDate } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Journaux d’audit" url="/admin/audit-logs?pageSize=100"
      columns={[
        { key: 'createdAt', label: 'Date', render: (r) => fmtDate(r.createdAt) },
        { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-[11px]">{r.action}</span> },
        { key: 'entityType', label: 'Entité', render: (r) => `${r.entityType}` },
        { key: 'actorRole', label: 'Acteur', render: (r) => r.actorRole || r.actorType },
        { key: 'requestId', label: 'Req', render: (r) => <span className="font-mono text-[10px]">{(r.requestId || '').slice(0, 8)}</span> },
      ]}
    />
  );
}
