'use client';
import { AdminTable } from '@/components/AdminTable';
import { fmtDate } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Alertes" url="/admin/alerts" intervalMs={8000}
      columns={[
        { key: 'severity', label: 'Gravité', render: (r) => <span className={`pill ${r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{r.severity}</span> },
        { key: 'code', label: 'Code' },
        { key: 'message', label: 'Message' },
        { key: 'createdAt', label: 'Depuis', render: (r) => fmtDate(r.createdAt) },
      ]}
    />
  );
}
