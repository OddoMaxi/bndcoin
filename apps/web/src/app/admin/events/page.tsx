'use client';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { fmtDay, human } from '@/lib/format';
export default function P() {
  return (
    <AdminTable title="Événements" url="/admin/events" intervalMs={0}
      columns={[
        { key: 'title', label: 'Titre' },
        { key: 'organizer', label: 'Organisateur', render: (r) => r.organizer?.name },
        { key: 'city', label: 'Ville' },
        { key: 'eventDate', label: 'Date', render: (r) => fmtDay(r.eventDate) },
        { key: 'status', label: 'Statut', render: (r) => human(r.status) },
        { key: 'tt', label: 'Billets', render: (r) => `${r.ticketTypes?.length ?? 0} types` },
      ]}
      actions={(r, reload) => (
        <div className="flex justify-end gap-1">
          {r.status === 'PENDING_APPROVAL' && <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={async () => { await adminAction(`/admin/events/${r.id}/status`, { status: 'PUBLISHED' }); reload(); }}>Publier</button>}
          {r.status === 'PUBLISHED' && <button className="rounded bg-gold px-2 py-1 text-xs text-ink" onClick={async () => { await adminAction(`/admin/events/${r.id}/feature`, { featured: !r.featured }); reload(); }}>{r.featured ? 'Retirer une' : 'Mettre à la une'}</button>}
        </div>
      )}
    />
  );
}
