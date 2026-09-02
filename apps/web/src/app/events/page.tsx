'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { fmtDay } from '@/lib/format';
import { Card } from '@/components/ui';

interface Ev {
  slug: string;
  title: string;
  category: string;
  city: string;
  venue: string;
  eventDate: string;
  coverImage: string | null;
  fromPriceGnf: string | null;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [cat, setCat] = useState('');
  useEffect(() => {
    api.get<Ev[]>(`/events${cat ? `?category=${cat}` : ''}`, { auth: false }).then(setEvents).catch(() => {});
  }, [cat]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Événements</h1>
      <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">Toutes catégories</option>
        {['CONCERT', 'FESTIVAL', 'CONFERENCE', 'SPORT', 'NIGHTLIFE', 'CULTURE', 'BUSINESS'].map((c) => (
          <option key={c} value={c}>
            {c[0] + c.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      {events.length === 0 && <Card className="text-center text-muted">Aucun événement.</Card>}
      {events.map((e) => (
        <Link key={e.slug} href={`/events/${e.slug}`} className="card block overflow-hidden p-0">
          {e.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.coverImage} alt="" className="h-36 w-full object-cover" />
          )}
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-gold">{e.category}</p>
            <p className="font-semibold">{e.title}</p>
            <p className="text-xs text-muted">
              {e.venue}, {e.city} · {fmtDay(e.eventDate)}
            </p>
            {e.fromPriceGnf && (
              <p className="mt-1 text-sm font-medium text-forest">
                Dès {Number(e.fromPriceGnf).toLocaleString('fr-GN')} GNF
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
