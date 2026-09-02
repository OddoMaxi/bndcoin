'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, newKey } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { fmtGNF, fmtRate, fmtUSDT } from '@/lib/format';

interface Quote {
  id: string;
  finalRate: string;
  feesGnf: string;
  gnfAmount: string;
  usdtAmount: string;
  expiresInSeconds: number;
}
interface Network {
  id: string;
  key: string;
  networkName: string;
  addressRegex: string | null;
}

export function TradePanel({ side }: { side: 'BUY_USDT' | 'SELL_USDT' }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [amount, setAmount] = useState(side === 'BUY_USDT' ? '1000000' : '100');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secs, setSecs] = useState(0);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  useEffect(() => {
    api.get<Network[]>('/crypto/networks', { auth: false }).then((n) => {
      setNetworks(n);
      if (n[0]) setNetworkId(n[0].id);
    });
  }, []);

  const isBuy = side === 'BUY_USDT';

  const fetchQuote = useCallback(
    async (val: string) => {
      setError(null);
      const clean = isBuy ? val.replace(/\D/g, '') : val;
      if (!clean || Number(clean) <= 0) {
        setQuote(null);
        return;
      }
      try {
        const body = isBuy ? { side, gnfAmount: clean } : { side, usdtAmount: clean };
        const q = await api.post<Quote>('/quotes', body, { idempotencyKey: newKey() });
        setQuote(q);
        setSecs(q.expiresInSeconds);
      } catch (err) {
        setQuote(null);
        setError((err as Error).message);
      }
    },
    [side, isBuy],
  );

  useEffect(() => {
    clearTimeout(deb.current);
    deb.current = setTimeout(() => void fetchQuote(amount), 450);
    return () => clearTimeout(deb.current);
  }, [amount, fetchQuote]);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs]);

  const expired = quote != null && secs <= 0;
  const net = networks.find((n) => n.id === networkId);
  const addrOk = !isBuy || (net && new RegExp(net.addressRegex ?? '^.{25,}$').test(address.trim()));

  async function submit() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      if (isBuy) {
        const o = await api.post<{ id: string }>(
          '/crypto/orders/buy',
          { quoteId: quote.id, networkId, destinationAddress: address.trim() },
          { idempotencyKey: newKey() },
        );
        router.push(`/crypto/orders/${o.id}`);
      } else {
        const o = await api.post<{ id: string }>(
          '/crypto/orders/sell',
          { quoteId: quote.id, networkId },
          { idempotencyKey: newKey() },
        );
        router.push(`/crypto/orders/${o.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">{isBuy ? 'Acheter de l’USDT' : 'Vendre de l’USDT'}</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">{isBuy ? 'Vous payez' : 'Vous vendez'}</label>
          <div className="flex items-center gap-2">
            <input
              className="field text-lg font-semibold"
              value={amount}
              inputMode={isBuy ? 'numeric' : 'decimal'}
              onChange={(e) => setAmount(isBuy ? e.target.value.replace(/[^\d]/g, '') : e.target.value.replace(/[^\d.]/g, ''))}
            />
            <span className="font-semibold text-muted">{isBuy ? 'GNF' : 'USDT'}</span>
          </div>
        </div>

        <div className="rounded-xl bg-forest-tint p-4">
          <p className="text-sm text-muted">Vous recevez</p>
          <p className="text-2xl font-bold text-forest">
            {quote ? (isBuy ? fmtUSDT(quote.usdtAmount) : fmtGNF(quote.gnfAmount)) : '—'}
          </p>
          {quote && (
            <p className="mt-1 text-xs text-muted">
              Taux {fmtRate(quote.finalRate)} · frais {fmtGNF(quote.feesGnf)} ·{' '}
              {expired ? <span className="font-semibold text-red-600">devis expiré</span> : `expire dans ${secs}s`}
            </p>
          )}
        </div>

        {expired && (
          <button className="btn-ghost w-full" onClick={() => void fetchQuote(amount)}>
            Actualiser le taux
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Réseau</label>
          <select className="field" value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.networkName}
              </option>
            ))}
          </select>
        </div>
        {isBuy && (
          <div>
            <label className="label">Votre adresse USDT ({net?.key})</label>
            <input
              className="field font-mono text-sm"
              placeholder={net?.key === 'TRON' ? 'T…' : '0x…'}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}
        <button
          className="btn-primary w-full"
          disabled={!quote || expired || busy || !addrOk}
          onClick={submit}
        >
          {busy ? '…' : isBuy ? 'Confirmer et payer' : 'Confirmer la vente'}
        </button>
        <p className="text-center text-xs text-muted">
          {isBuy
            ? 'Instructions de paiement mobile money à l’étape suivante.'
            : 'Vous recevrez une adresse de dépôt USDT à l’étape suivante.'}
        </p>
      </div>
    </div>
  );
}
