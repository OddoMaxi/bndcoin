'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { fmtGNF, human } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Règlements organisateurs" url="/admin/settlements" intervalMs={6000}
      columns={[
        { key: 'publicId', label: 'Réf', render: (r) => <span className="font-mono text-xs">{r.publicId}</span> },
        { key: 'organizer', label: 'Organisateur', render: (r) => r.organizer?.name },
        { key: 'event', label: 'Événement', render: (r) => r.event?.title ?? '—' },
        { key: 'gross', label: 'Brut', render: (r) => fmtGNF(r.grossGnf) },
        { key: 'fee', label: 'Commission', render: (r) => fmtGNF(r.platformFeeGnf) },
        { key: 'net', label: 'Net orga.', render: (r) => fmtGNF(r.organizerNetGnf) },
        { key: 'status', label: 'Statut', render: (r) => human(r.status) },
      ]}
      actions={(r, reload) => (
        <div className="flex justify-end gap-1">
          {r.status === 'PENDING' && <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { const e = await adminAction(`/admin/settlements/${r.id}/approve`); if (e) alert(e); reload(); }}>Approuver</button>}
          {r.status === 'APPROVED' && <button className="rounded bg-gold px-2 py-1 text-xs text-ink" onClick={async () => { const e = await adminAction(`/admin/settlements/${r.id}/pay`); if (e) alert(e); reload(); }}>Payer</button>}
        </div>
      )}
    />
  );
}
