'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PricingDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { formatRate } from '@/lib/format';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PricingDto>('/pricing/current', { auth: false })
      .then(setPricing)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <section className="card bg-forest text-white">
        <p className="text-sm/relaxed text-white/70">Achetez de l’USDT en quelques secondes</p>
        <h1 className="mt-1 text-2xl font-bold">Des francs guinéens vers l’USDT, simplement.</h1>
        <p className="mt-3 text-sm text-white/80">
          Pas de carnet d’ordres, pas de graphiques. Vous saisissez un montant, vous payez par
          mobile money, vous recevez vos USDT.
        </p>
        <Link href={user ? '/buy' : '/register'} className="btn-gold mt-5 w-full">
          {user ? 'Acheter de l’USDT' : 'Créer un compte'}
        </Link>
      </section>

      <section className="card">
        <p className="label">Taux d’achat actuel</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {pricing ? (
          <>
            <p className="text-2xl font-bold text-forest">{formatRate(pricing.buyRate)}</p>
            <p className="mt-1 text-xs text-muted">
              Marché {formatRate(pricing.marketRate)} · marge {(pricing.buySpreadBps / 100).toFixed(2)}%
            </p>
            <p className="mt-1 text-xs text-muted">
              Montant min {Number(pricing.minGnfAmount).toLocaleString('fr-GN')} GNF · max{' '}
              {Number(pricing.maxGnfAmount).toLocaleString('fr-GN')} GNF
            </p>
          </>
        ) : (
          !error && <p className="text-muted">Chargement…</p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[
          ['1', 'Saisir un montant en GNF'],
          ['2', 'Payer par Orange Money'],
          ['3', 'Recevoir vos USDT'],
        ].map(([n, label]) => (
          <div key={n} className="card px-3 py-4">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-forest-tint font-bold text-forest">
              {n}
            </div>
            <p className="mt-2 text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
