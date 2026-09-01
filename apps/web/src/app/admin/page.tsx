'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatGNF, formatUSDT, humanStatus } from '@/lib/format';

interface Dashboard {
  transactionsByStatus: Record<string, number>;
  transactionsToday: number;
  manualReviewOpen: number;
  users: number;
  treasury: {
    balances: { asset: 'GNF' | 'USDT'; available: string; reserved: string; total: string }[];
  };
}

export default function AdminHome() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>('/admin/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Transactions aujourd’hui" value={data.transactionsToday} />
        <Stat label="En revue" value={data.manualReviewOpen} />
        <Stat label="Utilisateurs" value={data.users} />
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Trésorerie</h2>
        {data.treasury.balances.map((b) => (
          <div key={b.asset} className="flex justify-between py-1 text-sm">
            <span className="font-medium">{b.asset}</span>
            <span>
              {b.asset === 'GNF' ? formatGNF(b.available) : formatUSDT(b.available)}{' '}
              <span className="text-muted">
                (réservé {b.asset === 'GNF' ? formatGNF(b.reserved) : formatUSDT(b.reserved)})
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Transactions par statut</h2>
        {Object.entries(data.transactionsByStatus).length === 0 && (
          <p className="text-sm text-muted">Aucune.</p>
        )}
        {Object.entries(data.transactionsByStatus).map(([status, count]) => (
          <div key={status} className="flex justify-between py-1 text-sm">
            <span>{humanStatus(status)}</span>
            <span className="font-semibold">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-3 py-4 text-center">
      <p className="text-2xl font-bold text-forest">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
