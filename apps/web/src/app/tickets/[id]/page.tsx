'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api-client';
import { fmtDay } from '@/lib/format';
import { BackLink, Card, StatusPill } from '@/components/ui';

interface T {
  id: string;
  publicTicketId: string;
  status: string;
  qrToken: string | null;
  ticketType: string;
  event: { title: string; date: string; venue: string; address: string | null; city: string };
  usedAt: string | null;
  usedGate: string | null;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<T | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<T>(`/tickets/${id}`)
      .then(async (tk) => {
        setT(tk);
        if (tk.qrToken) setQr(await QRCode.toDataURL(tk.qrToken, { margin: 1, width: 320 }));
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!t) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <BackLink href="/tickets">Mes billets</BackLink>
      <Card className="text-center">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">{t.publicTicketId}</span>
          <StatusPill status={t.status} />
        </div>
        <p className="mt-2 font-bold">{t.event.title}</p>
        <p className="text-xs text-muted">
          {t.ticketType} · {t.event.venue}, {t.event.city}
        </p>
        <p className="text-xs text-muted">{fmtDay(t.event.date)}</p>

        {qr ? (
          <div className="mx-auto mt-4 w-full max-w-[280px] rounded-2xl bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code du billet" className="w-full" />
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            {t.status === 'USED'
              ? `Billet utilisé${t.usedAt ? ` le ${new Date(t.usedAt).toLocaleString('fr-FR')}` : ''}${t.usedGate ? ` (porte ${t.usedGate})` : ''}`
              : `Billet ${t.status.toLowerCase()}`}
          </p>
        )}
        {qr && <p className="mt-3 text-xs text-muted">Présentez ce code à l’entrée.</p>}
      </Card>
    </div>
  );
}
