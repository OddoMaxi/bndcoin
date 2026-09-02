'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { fmtRate } from '@/lib/format';
import { Card } from '@/components/ui';

export default function CryptoHub() {
  const [rates, setRates] = useState<{ buyRate: string; sellRate: string } | null>(null);
  useEffect(() => {
    api.get<{ buyRate: string; sellRate: string }>('/pricing/rates', { auth: false }).then(setRates).catch(() => {});
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Crypto</h1>
      <Link href="/crypto/buy" className="card block">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-forest">Acheter de l’USDT</p>
            <p className="text-xs text-muted">Payez en GNF par Orange Money</p>
          </div>
          <span className="text-sm font-bold">{rates ? fmtRate(rates.buyRate) : '…'}</span>
        </div>
      </Link>
      <Link href="/crypto/sell" className="card block">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-forest">Vendre de l’USDT</p>
            <p className="text-xs text-muted">Recevez des GNF sur Orange Money</p>
          </div>
          <span className="text-sm font-bold">{rates ? fmtRate(rates.sellRate) : '…'}</span>
        </div>
      </Link>
      <Card className="text-sm text-muted">
        <Link href="/activity" className="font-medium text-forest">
          Voir mes transactions →
        </Link>
      </Card>
    </div>
  );
}
