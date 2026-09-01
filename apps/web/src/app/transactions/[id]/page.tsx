'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { TransactionDto } from '@bn/shared-types';
import { api, MOCK_ENABLED } from '@/lib/api-client';
import { formatDateTime, formatGNF, formatUSDT, humanStatus } from '@/lib/format';
import { BackLink, StatusPill, StatusStepper } from '@/components/ui';

const ACTIVE = new Set([
  'CREATED',
  'QUOTE_LOCKED',
  'WAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMED',
  'USDT_PROCESSING',
  'USDT_SENT',
]);

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<TransactionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const load = useCallback(async () => {
    try {
      setTx(await api.get<TransactionDto>(`/transactions/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tx || !ACTIVE.has(tx.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [tx, load]);

  async function simulate(path: string, body: unknown) {
    setSimulating(true);
    try {
      await api.post(path, body);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSimulating(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!tx) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-5">
      <BackLink href="/transactions">Toutes les transactions</BackLink>

      <div className="card">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-muted">{tx.publicId}</span>
          <StatusPill status={tx.status} />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted">Vous payez</p>
            <p className="text-lg font-bold">{formatGNF(tx.gnfAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Vous recevez</p>
            <p className="text-lg font-bold text-forest">{formatUSDT(tx.usdtAmount)}</p>
          </div>
        </div>
        <p className="mt-2 break-all font-mono text-xs text-muted">→ {tx.destinationAddress}</p>
      </div>

      {tx.paymentInstructions && (
        <div className="card border-gold/40 bg-gold-soft/20">
          <h2 className="font-semibold">Instructions de paiement</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Bénéficiaire" v={tx.paymentInstructions.payToName} />
            <Row k="Numéro" v={tx.paymentInstructions.payToNumber} />
            <Row k="Montant" v={formatGNF(tx.paymentInstructions.amount)} />
            <Row k="Référence" v={tx.paymentInstructions.reference} />
            <Row k="Expire" v={formatDateTime(tx.paymentInstructions.expiresAt)} />
          </dl>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Suivi</h2>
        <StatusStepper status={tx.status} />
        {tx.cryptoTxHash && (
          <p className="mt-4 break-all text-xs text-muted">
            Hash: <span className="font-mono">{tx.cryptoTxHash}</span> · {tx.cryptoConfirmations}/
            {tx.requiredConfirmations} confirmations
          </p>
        )}
        {tx.manualReviewReason && (
          <p className="mt-3 text-sm text-gold">Revue: {tx.manualReviewReason}</p>
        )}
        {tx.failureReason && <p className="mt-3 text-sm text-red-600">{tx.failureReason}</p>}
      </div>

      {MOCK_ENABLED && ACTIVE.has(tx.status) && (
        <div className="card border-dashed">
          <h2 className="font-semibold text-muted">Simulation (démo)</h2>
          <p className="mb-3 text-xs text-muted">
            Nécessite un compte admin. Reproduit les rappels des prestataires.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-ghost"
              disabled={simulating}
              onClick={() => simulate(`/mock/payment/${tx.id}/event`, { scenario: 'PAYMENT_SUCCESS' })}
            >
              Paiement réussi
            </button>
            <button
              className="btn-ghost"
              disabled={simulating}
              onClick={() => simulate(`/mock/payment/${tx.id}/event`, { scenario: 'PAYMENT_FAILED' })}
            >
              Paiement échoué
            </button>
            <button
              className="btn-ghost"
              disabled={simulating}
              onClick={() => simulate(`/mock/payment/${tx.id}/event`, { scenario: 'TIMEOUT' })}
            >
              Délai dépassé
            </button>
            <button
              className="btn-ghost"
              disabled={simulating}
              onClick={() => simulate(`/mock/crypto/${tx.id}/event`, { scenario: 'CONFIRMED' })}
            >
              Confirmer on-chain
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 font-semibold">Historique</h2>
        <ol className="space-y-2 text-sm">
          {tx.events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{humanStatus(e.nextStatus)}</span>
              <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
