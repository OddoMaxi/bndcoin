'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PricingDto, QuoteDto, TransactionDto } from '@bn/shared-types';
import { api, newIdempotencyKey } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { formatGNF, formatRate, formatUSDT } from '@/lib/format';

export default function BuyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [pricing, setPricing] = useState<PricingDto | null>(null);
  const [amount, setAmount] = useState('1000000');
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    api.get<PricingDto>('/pricing/current', { auth: false }).then(setPricing).catch(() => {});
  }, []);

  const fetchQuote = useCallback(async (gnf: string) => {
    setError(null);
    if (!/^\d+$/.test(gnf) || Number(gnf) <= 0) {
      setQuote(null);
      return;
    }
    try {
      const q = await api.post<QuoteDto>(
        '/quotes',
        { gnfAmount: gnf },
        { idempotencyKey: newIdempotencyKey() },
      );
      setQuote(q);
      setSecondsLeft(q.expiresInSeconds);
    } catch (err) {
      setQuote(null);
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void fetchQuote(amount), 450);
    return () => clearTimeout(debounce.current);
  }, [amount, fetchQuote]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const expired = quote != null && secondsLeft <= 0;

  async function accept() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await api.post<TransactionDto>(
        `/quotes/${quote.id}/accept`,
        { destinationAddress: address.trim() },
        { idempotencyKey: newIdempotencyKey() },
      );
      router.push(`/transactions/${tx.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const receiveLabel = useMemo(
    () => (quote ? formatUSDT(quote.usdtAmount) : '—'),
    [quote],
  );

  if (loading || !user) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Acheter de l’USDT</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">Vous payez</label>
          <div className="flex items-center gap-2">
            <input
              className="field text-lg font-semibold"
              value={amount}
              inputMode="numeric"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
            <span className="font-semibold text-muted">GNF</span>
          </div>
          {pricing && (
            <p className="mt-1 text-xs text-muted">
              min {formatGNF(pricing.minGnfAmount)} · max {formatGNF(pricing.maxGnfAmount)}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-forest-tint p-4">
          <p className="text-sm text-muted">Vous recevez</p>
          <p className="text-2xl font-bold text-forest">{receiveLabel}</p>
          {quote && (
            <p className="mt-1 text-xs text-muted">
              Taux {formatRate(quote.bnRate)} ·{' '}
              {expired ? (
                <span className="font-semibold text-red-600">devis expiré</span>
              ) : (
                <span>expire dans {secondsLeft}s</span>
              )}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {expired && (
          <button className="btn-ghost w-full" onClick={() => void fetchQuote(amount)}>
            Actualiser le taux
          </button>
        )}
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Adresse USDT de réception (TRON ou EVM)</label>
          <input
            className="field font-mono text-sm"
            placeholder="T… ou 0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <button
          className="btn-primary w-full"
          disabled={!quote || expired || busy || address.trim().length < 20}
          onClick={accept}
        >
          {busy ? '…' : 'Confirmer et payer'}
        </button>
        <p className="text-center text-xs text-muted">
          Vous recevrez ensuite les instructions de paiement mobile money.
        </p>
      </div>
    </div>
  );
}
