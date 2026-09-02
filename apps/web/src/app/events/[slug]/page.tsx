'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, MOCK_ENABLED, newKey } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { fmtDay, fmtGNF } from '@/lib/format';
import { BackLink, Card } from '@/components/ui';

interface TT {
  id: string;
  name: string;
  description: string | null;
  priceGnf: string;
  available: number;
  maxPerOrder: number;
}
interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  address: string | null;
  city: string;
  eventDate: string;
  coverImage: string | null;
  ticketTypes: TT[];
}

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ev, setEv] = useState<EventDetail | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    api.get<EventDetail>(`/events/${slug}`, { auth: false }).then(setEv).catch((e) => setError(e.message));
  }, [slug]);

  const total = useMemo(() => {
    if (!ev) return 0;
    return ev.ticketTypes.reduce((s, t) => s + (qty[t.id] ?? 0) * Number(t.priceGnf), 0);
  }, [ev, qty]);

  async function checkout() {
    if (!user) return router.push('/login');
    if (!ev) return;
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (!items.length) return;
    setBusy(true);
    setError(null);
    try {
      const o = await api.post<{ orderId: string; status: string }>(
        '/event-orders',
        { eventId: ev.id, items, currency: 'GNF' },
        { idempotencyKey: newKey() },
      );
      setPlaced({ id: o.orderId, status: o.status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function simulatePay() {
    if (!placed) return;
    setBusy(true);
    try {
      await api.post(`/mock/orange/payment/${placed.id}/event`, { scenario: 'PAYMENT_SUCCESS' });
      router.push('/tickets');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !ev) return <p className="text-sm text-red-600">{error}</p>;
  if (!ev) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <BackLink href="/events">Événements</BackLink>
      {ev.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ev.coverImage} alt="" className="h-44 w-full rounded-2xl object-cover" />
      )}
      <div>
        <h1 className="text-xl font-bold">{ev.title}</h1>
        <p className="text-sm text-muted">
          {ev.venue}, {ev.city} · {fmtDay(ev.eventDate)}
        </p>
      </div>
      {ev.description && <p className="text-sm text-muted">{ev.description}</p>}

      {placed ? (
        <Card className="space-y-3">
          <p className="font-semibold text-forest">Commande créée ({placed.id.slice(0, 8)})</p>
          <p className="text-sm text-muted">
            Payez {fmtGNF(total)} par Orange Money pour recevoir vos billets.
          </p>
          {MOCK_ENABLED && (
            <button className="btn-primary w-full" disabled={busy} onClick={simulatePay}>
              Simuler le paiement (démo)
            </button>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {ev.ticketTypes.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">{t.description}</p>
                    <p className="mt-1 text-sm font-medium text-forest">{fmtGNF(t.priceGnf)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-8 w-8 rounded-full border border-black/10"
                      onClick={() => setQty({ ...qty, [t.id]: Math.max(0, (qty[t.id] ?? 0) - 1) })}
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold">{qty[t.id] ?? 0}</span>
                    <button
                      className="h-8 w-8 rounded-full border border-black/10 disabled:opacity-40"
                      disabled={(qty[t.id] ?? 0) >= Math.min(t.available, t.maxPerOrder)}
                      onClick={() => setQty({ ...qty, [t.id]: (qty[t.id] ?? 0) + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted">{t.available} disponibles</p>
              </Card>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || total === 0} onClick={checkout}>
            {total > 0 ? `Payer ${fmtGNF(total)}` : 'Sélectionnez des billets'}
          </button>
        </>
      )}
    </div>
  );
}
