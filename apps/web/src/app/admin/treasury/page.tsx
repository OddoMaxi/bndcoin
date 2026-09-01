'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Paginated, TreasuryBalanceDto } from '@bn/shared-types';
import { api, newIdempotencyKey } from '@/lib/api-client';
import { formatDateTime, formatGNF, formatUSDT } from '@/lib/format';

interface LedgerRow {
  id: string;
  asset: 'GNF' | 'USDT';
  direction: 'CREDIT' | 'DEBIT';
  bucket: string;
  amount: string;
  refType: string;
  memo: string | null;
  createdAt: string;
}

export default function AdminTreasury() {
  const [balances, setBalances] = useState<TreasuryBalanceDto[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [form, setForm] = useState({ asset: 'USDT', direction: 'CREDIT', amount: '', memo: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [overview, l] = await Promise.all([
      api.get<{ balances: TreasuryBalanceDto[] }>('/admin/treasury'),
      api.get<Paginated<LedgerRow>>('/admin/treasury/ledger?pageSize=25'),
    ]);
    setBalances(overview.balances);
    setLedger(l.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/admin/treasury/adjust', form, { idempotencyKey: newIdempotencyKey() });
      setForm({ ...form, amount: '', memo: '' });
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {balances.map((b) => (
          <div key={b.asset} className="card">
            <p className="text-xs text-muted">{b.asset}</p>
            <p className="text-lg font-bold text-forest">
              {b.asset === 'GNF' ? formatGNF(b.available) : formatUSDT(b.available)}
            </p>
            <p className="text-xs text-muted">
              réservé {b.asset === 'GNF' ? formatGNF(b.reserved) : formatUSDT(b.reserved)}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={adjust} className="card space-y-3">
        <h2 className="font-semibold">Ajustement manuel</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>
            <option value="USDT">USDT</option>
            <option value="GNF">GNF</option>
          </select>
          <select
            className="field"
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value })}
          >
            <option value="CREDIT">Crédit</option>
            <option value="DEBIT">Débit</option>
          </select>
        </div>
        <input
          className="field"
          placeholder="Montant"
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          className="field"
          placeholder="Note"
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
        />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full">Appliquer</button>
      </form>

      <div className="card">
        <h2 className="mb-2 font-semibold">Grand livre</h2>
        <ol className="space-y-2 text-sm">
          {ledger.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span>
                <span className={r.direction === 'CREDIT' ? 'text-forest' : 'text-red-600'}>
                  {r.direction === 'CREDIT' ? '+' : '−'}
                  {r.asset === 'GNF' ? formatGNF(r.amount) : formatUSDT(r.amount)}
                </span>{' '}
                <span className="text-xs text-muted">
                  {r.bucket} · {r.refType}
                </span>
              </span>
              <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
