'use client';

import { useEffect, useState } from 'react';
import type { QuoteDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { formatDateTime, formatGNF, formatRate, formatUSDT } from '@/lib/format';
import { StatusPill } from '@/components/ui';

export default function AdminQuotes() {
  const [items, setItems] = useState<QuoteDto[]>([]);

  useEffect(() => {
    api.get<QuoteDto[]>('/admin/quotes').then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-3">
      {items.map((q) => (
        <div key={q.id} className="card">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{q.publicId}</span>
            <StatusPill status={q.status} />
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span>{formatGNF(q.gnfAmount)}</span>
            <span className="text-forest">{formatUSDT(q.usdtAmount)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatRate(q.bnRate)} · créé {formatDateTime(q.createdAt)}
          </p>
        </div>
      ))}
      {items.length === 0 && <p className="text-muted">Aucun devis.</p>}
    </div>
  );
}
