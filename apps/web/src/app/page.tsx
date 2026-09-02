'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { fmtDay, fmtRate } from '@/lib/format';
import { Card } from '@/components/ui';

interface Rates {
  buyRate: string;
  sellRate: string;
  referenceRate: string;
  minGnfAmount: string;
  maxGnfAmount: string;
}
interface EventCard {
  slug: string;
  title: string;
  city: string;
  venue: string;
  eventDate: string;
  coverImage: string | null;
  fromPriceGnf: string | null;
}

export default function Home() {
  const { user } = useAuth();
  const [rates, setRates] = useState<Rates | null>(null);
  const [events, setEvents] = useState<EventCard[]>([]);

  useEffect(() => {
    api.get<Rates>('/pricing/rates', { auth: false }).then(setRates).catch(() => {});
    api.get<EventCard[]>('/events?featured=true', { auth: false }).then(setEvents).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <section className="card bg-forest text-white">
        <p className="text-sm text-white/70">Bienvenue{user ? `, ${user.firstName}` : ''}</p>
        <h1 className="mt-1 text-xl font-bold">Achetez de l’USDT. Vendez de l’USDT. En quelques secondes.</h1>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={user ? '/crypto/buy' : '/login'} className="btn-gold">
            Acheter USDT
          </Link>
          <Link href={user ? '/crypto/sell' : '/login'} className="btn bg-white/10 text-white hover:bg-white/20">
            Vendre USDT
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Card>
          <p className="label">Taux d’achat</p>
          <p className="text-lg font-bold text-forest">{rates ? fmtRate(rates.buyRate) : '…'}</p>
        </Card>
        <Card>
          <p className="label">Taux de vente</p>
          <p className="text-lg font-bold text-forest">{rates ? fmtRate(rates.sellRate) : '…'}</p>
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Événements à la une</h2>
          <Link href="/events" className="text-sm font-medium text-forest">
            Tout voir
          </Link>
        </div>
        <div className="space-y-3">
          {events.length === 0 && <Card className="text-center text-muted">Aucun événement pour le moment.</Card>}
          {events.map((e) => (
            <Link key={e.slug} href={`/events/${e.slug}`} className="card block overflow-hidden p-0">
              {e.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverImage} alt="" className="h-32 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-muted">
                  {e.venue}, {e.city} · {fmtDay(e.eventDate)}
                </p>
                {e.fromPriceGnf && (
                  <p className="mt-1 text-sm font-medium text-forest">Dès {Number(e.fromPriceGnf).toLocaleString('fr-GN')} GNF</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
