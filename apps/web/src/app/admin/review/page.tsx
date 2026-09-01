'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TransactionDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { formatGNF, formatUSDT, humanStatus } from '@/lib/format';

const DECISIONS: { key: string; label: string }[] = [
  { key: 'RETRY_USDT', label: 'Relancer l’envoi' },
  { key: 'COMPLETE', label: 'Forcer terminé' },
  { key: 'FAIL', label: 'Marquer échoué' },
  { key: 'CANCEL', label: 'Annuler' },
];

export default function AdminReview() {
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await api.get<TransactionDto[]>('/admin/transactions/review-queue'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, decision: string) {
    setMsg(null);
    try {
      await api.post(`/admin/transactions/${id}/review/resolve`, {
        decision,
        reason: `review resolved as ${decision}`,
      });
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {items.length === 0 && <p className="text-muted">Rien en attente de revue.</p>}
      {items.map((tx) => (
        <div key={tx.id} className="card">
          <div className="flex justify-between">
            <span className="font-mono text-xs text-muted">{tx.publicId}</span>
            <span className="text-xs text-muted">{humanStatus(tx.status)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span>{formatGNF(tx.gnfAmount)}</span>
            <span className="text-forest">{formatUSDT(tx.usdtAmount)}</span>
          </div>
          {tx.manualReviewReason && (
            <p className="mt-1 text-xs text-gold">{tx.manualReviewReason}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-black/5 pt-2">
            {DECISIONS.map((d) => (
              <button
                key={d.key}
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => resolve(tx.id, d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
