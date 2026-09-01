'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Paginated, TransactionDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { formatGNF, formatUSDT, formatDateTime } from '@/lib/format';
import { Empty, StatusPill } from '@/components/ui';

export default function TransactionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<TransactionDto[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<Paginated<TransactionDto>>('/transactions?pageSize=50')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [user]);

  if (loading || !user) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mes transactions</h1>
      {!items && <p className="text-muted">Chargement…</p>}
      {items && items.length === 0 && (
        <Empty>
          Aucune transaction pour le moment.{' '}
          <Link href="/buy" className="font-semibold text-forest">
            Acheter de l’USDT
          </Link>
        </Empty>
      )}
      {items?.map((tx) => (
        <Link key={tx.id} href={`/transactions/${tx.id}`} className="card block">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">{tx.publicId}</span>
            <StatusPill status={tx.status} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-semibold">{formatGNF(tx.gnfAmount)}</span>
            <span className="text-forest">→ {formatUSDT(tx.usdtAmount)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{formatDateTime(tx.createdAt)}</p>
        </Link>
      ))}
    </div>
  );
}
