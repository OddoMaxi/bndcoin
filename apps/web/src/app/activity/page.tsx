'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtGNF, fmtUSDT } from '@/lib/format';
import { Card, StatusPill } from '@/components/ui';

interface Row {
  id: string;
  publicId: string;
  side: string;
  status: string;
  gnfAmount: string;
  usdtAmount: string;
  createdAt: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  useEffect(() => {
    if (user) api.get<{ items: Row[] }>('/crypto/orders').then((r) => setOrders(r.items)).catch(() => setOrders([]));
  }, [user]);

  if (loading || !user) return <p className="text-muted">Chargement…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mon activité</h1>
      {!orders && <p className="text-muted">Chargement…</p>}
      {orders?.length === 0 && (
        <Card className="text-center text-muted">
          Aucune transaction.{' '}
          <Link href="/crypto" className="font-semibold text-forest">
            Acheter / vendre de l’USDT
          </Link>
        </Card>
      )}
      {orders?.map((o) => (
        <Link key={o.id} href={`/crypto/orders/${o.id}`} className="card block">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{o.publicId}</span>
            <StatusPill status={o.status} />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-semibold">{o.side === 'BUY_USDT' ? 'Achat USDT' : 'Vente USDT'}</span>
            <span className="text-forest">
              {o.side === 'BUY_USDT' ? `${fmtGNF(o.gnfAmount)} → ${fmtUSDT(o.usdtAmount)}` : `${fmtUSDT(o.usdtAmount)} → ${fmtGNF(o.gnfAmount)}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{fmtDate(o.createdAt)}</p>
        </Link>
      ))}
    </div>
  );
}
