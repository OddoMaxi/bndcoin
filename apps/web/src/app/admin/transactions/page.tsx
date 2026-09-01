'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Paginated, TransactionDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { formatDateTime, formatGNF, formatUSDT, humanStatus } from '@/lib/format';
import { StatusPill } from '@/components/ui';

const STATUSES = [
  'ALL',
  'WAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'USDT_SENT',
  'COMPLETED',
  'MANUAL_REVIEW',
  'FAILED',
  'EXPIRED',
];

export default function AdminTransactions() {
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<TransactionDto | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = filter === 'ALL' ? '' : `?status=${filter}`;
    const res = await api.get<Paginated<TransactionDto>>(`/admin/transactions${qs}`);
    setItems(res.items);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(id: string, toStatus: string) {
    setMsg(null);
    try {
      await api.post(`/admin/transactions/${id}/transition`, {
        toStatus,
        reason: `manual transition to ${toStatus}`,
      });
      await load();
      setSelected(null);
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <select className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === 'ALL' ? 'Tous les statuts' : humanStatus(s)}
          </option>
        ))}
      </select>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {items.map((tx) => (
        <div key={tx.id} className="card">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{tx.publicId}</span>
            <StatusPill status={tx.status} />
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span>{formatGNF(tx.gnfAmount)}</span>
            <span className="text-forest">{formatUSDT(tx.usdtAmount)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{formatDateTime(tx.createdAt)}</p>
          <button
            className="mt-2 text-sm font-medium text-forest"
            onClick={() => setSelected(selected?.id === tx.id ? null : tx)}
          >
            {selected?.id === tx.id ? 'Masquer' : 'Gérer'}
          </button>
          {selected?.id === tx.id && (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-black/5 pt-2">
              {['PAYMENT_CONFIRMED', 'USDT_PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'CANCELLED'].map(
                (s) => (
                  <button key={s} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => transition(tx.id, s)}>
                    → {humanStatus(s)}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="text-muted">Aucune transaction.</p>}
    </div>
  );
}
