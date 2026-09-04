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
      actions={(r, reload) => {
        const TERMINAL = ['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'];
        // UNDER_REVIEW isn't a legal transition target from these very early,
        // short-lived states (order creation resolves them synchronously) —
        // CANCELLED is the only admin override available there.
        const PRE_REVIEW = ['CREATED', 'QUOTE_LOCKED', 'USDT_RESERVED'];

        const resolve = async (decision: 'RETRY' | 'FORCE_COMPLETE' | 'FAIL' | 'CANCEL') => {
          const reason = window.prompt(`Motif (${decision}) :`, 'admin override');
          if (reason === null) return;
          const e = await adminAction(`/admin/crypto/orders/${r.id}/resolve`, { decision, reason });
          if (e) alert(e);
          reload();
        };
        const transition = async (toStatus: 'UNDER_REVIEW' | 'CANCELLED') => {
          const reason = window.prompt(`Motif (${toStatus}) :`, 'admin override');
          if (reason === null) return;
          const e = await adminAction(`/admin/crypto/orders/${r.id}/transition`, { toStatus, reason });
          if (e) alert(e);
          reload();
        };

        if (r.status === 'UNDER_REVIEW') {
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <button className="rounded bg-forest px-2 py-1 text-xs text-white" onClick={() => resolve('RETRY')}>
                Reprendre
              </button>
              <button className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" onClick={() => resolve('FORCE_COMPLETE')}>
                Forcer terminé
              </button>
              <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => resolve('FAIL')}>
                Échec
              </button>
              <button className="rounded bg-slate-600 px-2 py-1 text-xs text-white" onClick={() => resolve('CANCEL')}>
                Annuler
              </button>
            </div>
          );
        }
        if (TERMINAL.includes(r.status)) {
          return <span className="text-xs text-muted">{human(r.status)}</span>;
        }
        if (PRE_REVIEW.includes(r.status)) {
          return (
            <div className="flex justify-end gap-1">
              <button className="rounded bg-slate-600 px-2 py-1 text-xs text-white" onClick={() => transition('CANCELLED')}>
                Annuler
              </button>
            </div>
          );
        }
        return (
          <div className="flex justify-end gap-1">
            <button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => transition('UNDER_REVIEW')}>
              Mettre en revue
            </button>
          </div>
        );
      }}
    />
  );
}
