'use client';

import { useState } from 'react';
import { AdminTable, adminAction } from '@/components/AdminTable';
import { StatusPill } from '@/components/ui';
import { fmtGNF, fmtRate, fmtUSDT, human } from '@/lib/format';

export default function AdminCrypto() {
  const [side, setSide] = useState('');
  const [status, setStatus] = useState('');
  const qs = [side && `side=${side}`, status && `status=${status}`].filter(Boolean).join('&');
  return (
    <AdminTable
      key={qs}
      title="Ordres crypto"
      url={`/admin/crypto/orders${qs ? `?${qs}` : ''}`}
      intervalMs={6000}
      filters={
        <>
          <select className="field !w-auto !py-1.5" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="">Achat + Vente</option>
            <option value="BUY_USDT">Achat</option>
            <option value="SELL_USDT">Vente</option>
          </select>
          <select className="field !w-auto !py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            {['AWAITING_PAYMENT', 'AWAITING_CRYPTO', 'PAYOUT_PROCESSING', 'COMPLETED', 'UNDER_REVIEW', 'FAILED', 'EXPIRED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </>
      }
      columns={[
        { key: 'publicId', label: 'Réf', render: (r) => <span className="font-mono text-xs">{r.publicId}</span> },
        { key: 'side', label: 'Sens', render: (r) => (r.side === 'BUY_USDT' ? 'Achat' : 'Vente') },
        { key: 'status', label: 'Statut', render: (r) => <StatusPill status={r.status} /> },
        { key: 'gnfAmount', label: 'GNF', render: (r) => fmtGNF(r.gnfAmount) },
        { key: 'usdtAmount', label: 'USDT', render: (r) => fmtUSDT(r.usdtAmount) },
        { key: 'finalRate', label: 'Taux', render: (r) => fmtRate(r.finalRate) },
      ]}
      actions={(r, reload) =>
        ['UNDER_REVIEW', 'AWAITING_PAYMENT', 'PAYMENT_VERIFIED', 'USDT_SENT'].includes(r.status) ? (
          <div className="flex justify-end gap-1">
            <button
              className="rounded bg-forest px-2 py-1 text-xs text-white"
              onClick={async () => {
                const e = await adminAction(`/admin/crypto/orders/${r.id}/transition`, {
                  toStatus: 'COMPLETED',
                  reason: 'admin override',
                });
                if (e) alert(e);
                reload();
              }}
            >
              Terminer
            </button>
            <button
              className="rounded bg-red-600 px-2 py-1 text-xs text-white"
              onClick={async () => {
                const e = await adminAction(`/admin/crypto/orders/${r.id}/transition`, {
                  toStatus: 'FAILED',
                  reason: 'admin override',
                });
                if (e) alert(e);
                reload();
              }}
            >
              Échec
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">{human(r.status)}</span>
        )
      }
    />
  );
}
