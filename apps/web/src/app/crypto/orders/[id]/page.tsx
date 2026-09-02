'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, MOCK_ENABLED } from '@/lib/api-client';
import { fmtGNF, fmtUSDT, fmtRate, human, fmtDate } from '@/lib/format';
import { BackLink, Card, StatusPill, Stepper } from '@/components/ui';

interface Order {
  id: string;
  publicId: string;
  side: string;
  status: string;
  finalRate: string;
  feesGnf: string;
  gnfAmount: string;
  usdtAmount: string;
  destinationAddress: string | null;
  depositAddress: string | null;
  cryptoTxHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  failureReason: string | null;
  reviewReason: string | null;
  paymentIntent: { publicId: string; status: string; amount: string; reference: string | null } | null;
  payout: { publicId: string; status: string } | null;
  createdAt: string;
  completedAt: string | null;
  events: { nextStatus: string; event: string; reason: string | null; createdAt: string }[];
}

const ACTIVE = new Set([
  'CREATED',
  'QUOTE_LOCKED',
  'USDT_RESERVED',
  'AWAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_VERIFIED',
  'USDT_PROCESSING',
  'USDT_SENT',
  'AWAITING_CRYPTO',
  'CRYPTO_DETECTED',
  'CONFIRMING',
  'CRYPTO_CONFIRMED',
  'GNF_RESERVED',
  'PAYOUT_PENDING',
  'PAYOUT_PROCESSING',
]);

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sim, setSim] = useState(false);

  const load = useCallback(async () => {
    try {
      setO(await api.get<Order>(`/crypto/orders/${id}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!o || !ACTIVE.has(o.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [o, load]);

  async function simulate(path: string, body: unknown) {
    setSim(true);
    try {
      await api.post(path, body);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSim(false);
    }
  }

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!o) return <p className="text-muted">Chargement…</p>;
  const isBuy = o.side === 'BUY_USDT';

  return (
    <div className="space-y-5">
      <BackLink href="/activity">Mon activité</BackLink>
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-muted">{o.publicId}</span>
          <StatusPill status={o.status} />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted">{isBuy ? 'Vous payez' : 'Vous vendez'}</p>
            <p className="text-lg font-bold">{isBuy ? fmtGNF(o.gnfAmount) : fmtUSDT(o.usdtAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Vous recevez</p>
            <p className="text-lg font-bold text-forest">{isBuy ? fmtUSDT(o.usdtAmount) : fmtGNF(o.gnfAmount)}</p>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">Taux {fmtRate(o.finalRate)} · frais {fmtGNF(o.feesGnf)}</p>
      </Card>

      {isBuy && o.paymentIntent && ['AWAITING_PAYMENT', 'PAYMENT_DETECTED'].includes(o.status) && (
        <Card className="border-gold/40 bg-gold/10">
          <h2 className="font-semibold">Instructions de paiement</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Bénéficiaire" v="Bory & Norbert" />
            <Row k="Montant" v={fmtGNF(o.paymentIntent.amount)} />
            <Row k="Référence" v={o.paymentIntent.publicId} />
          </dl>
        </Card>
      )}

      {!isBuy && o.depositAddress && ['AWAITING_CRYPTO', 'CRYPTO_DETECTED', 'CONFIRMING'].includes(o.status) && (
        <Card className="border-gold/40 bg-gold/10">
          <h2 className="font-semibold">Envoyez vos USDT</h2>
          <p className="mt-1 text-sm text-muted">Montant exact : {fmtUSDT(o.usdtAmount)}</p>
          <p className="mt-2 break-all rounded-lg bg-white p-2 font-mono text-xs">{o.depositAddress}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Suivi</h2>
        <Stepper side={o.side} status={o.status} />
        {o.cryptoTxHash && (
          <p className="mt-4 break-all text-xs text-muted">
            Hash : <span className="font-mono">{o.cryptoTxHash}</span> · {o.confirmations}/{o.requiredConfirmations} conf.
          </p>
        )}
        {o.reviewReason && <p className="mt-3 text-sm text-gold">Revue : {o.reviewReason}</p>}
        {o.failureReason && <p className="mt-3 text-sm text-red-600">{o.failureReason}</p>}
      </Card>

      {MOCK_ENABLED && ACTIVE.has(o.status) && (
        <Card className="border-dashed">
          <h2 className="font-semibold text-muted">Simulation (démo — compte admin requis)</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {isBuy ? (
              <>
                <button className="btn-ghost" disabled={sim} onClick={() => simulate(`/mock/orange/payment/${o.id}/event`, { scenario: 'PAYMENT_SUCCESS' })}>
                  Paiement reçu
                </button>
                <button className="btn-ghost" disabled={sim} onClick={() => simulate(`/mock/crypto/send/${o.id}/event`, { scenario: 'CONFIRMED' })}>
                  Confirmer on-chain
                </button>
                <button className="btn-ghost" disabled={sim} onClick={() => simulate(`/mock/orange/payment/${o.id}/event`, { scenario: 'PAYMENT_FAILED' })}>
                  Paiement échoué
                </button>
              </>
            ) : (
              <>
                <button className="btn-ghost" disabled={sim} onClick={() => simulate(`/mock/crypto/deposit/${o.id}/event`, { scenario: 'CONFIRMED' })}>
                  Dépôt confirmé
                </button>
                <button className="btn-ghost" disabled={sim} onClick={() => simulate(`/mock/crypto/deposit/${o.id}/event`, { scenario: 'AMOUNT_MISMATCH' })}>
                  Montant incorrect
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Historique</h2>
        <ol className="space-y-2 text-sm">
          {o.events.map((e, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{human(e.nextStatus)}</span>
              <span className="text-xs text-muted">{fmtDate(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </Card>
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
