'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { fmtDay, human } from '@/lib/format';
import { Card, StatusPill } from '@/components/ui';

interface T {
  id: string;
  publicTicketId: string;
  status: string;
  ticketType: string;
  event: { title: string; slug: string; date: string; venue: string; city: string };
  usedAt: string | null;
}

export default function TicketsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tickets, setTickets] = useState<T[] | null>(null);
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  useEffect(() => {
    if (user) api.get<T[]>('/tickets').then(setTickets).catch(() => setTickets([]));
  }, [user]);

  if (loading || !user) return <p className="text-muted">Chargement…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mes billets</h1>
      {!tickets && <p className="text-muted">Chargement…</p>}
      {tickets?.length === 0 && (
        <Card className="text-center text-muted">
          Aucun billet.{' '}
          <Link href="/events" className="font-semibold text-forest">
            Découvrir des événements
          </Link>
        </Card>
      )}
      {tickets?.map((t) => (
        <Link key={t.id} href={`/tickets/${t.id}`} className="card block">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{t.publicTicketId}</span>
            <StatusPill status={t.status} />
          </div>
          <p className="mt-1 font-semibold">{t.event.title}</p>
          <p className="text-xs text-muted">
            {t.ticketType} · {t.event.venue}, {t.event.city} · {fmtDay(t.event.date)}
          </p>
          {t.usedAt && <p className="mt-1 text-xs text-muted">Utilisé le {new Date(t.usedAt).toLocaleString('fr-FR')}</p>}
        </Link>
      ))}
    </div>
  );
}
