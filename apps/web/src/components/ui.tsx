'use client';

import Link from 'next/link';
import { human } from '@/lib/format';

const CRYPTO_STEPS: Record<string, string[]> = {
  BUY_USDT: [
    'QUOTE_LOCKED',
    'USDT_RESERVED',
    'AWAITING_PAYMENT',
    'PAYMENT_VERIFIED',
    'USDT_PROCESSING',
    'USDT_SENT',
    'COMPLETED',
  ],
  SELL_USDT: [
    'QUOTE_LOCKED',
    'AWAITING_CRYPTO',
    'CRYPTO_CONFIRMED',
    'GNF_RESERVED',
    'PAYOUT_PROCESSING',
    'COMPLETED',
  ],
};

const LABELS: Record<string, string> = {
  QUOTE_LOCKED: 'Devis verrouillé',
  USDT_RESERVED: 'Liquidité réservée',
  AWAITING_PAYMENT: 'En attente du paiement',
  PAYMENT_VERIFIED: 'Paiement vérifié',
  USDT_PROCESSING: 'Envoi USDT en cours',
  USDT_SENT: 'USDT envoyé',
  AWAITING_CRYPTO: 'En attente de vos USDT',
  CRYPTO_CONFIRMED: 'USDT confirmés',
  GNF_RESERVED: 'GNF réservés',
  PAYOUT_PROCESSING: 'Versement en cours',
  COMPLETED: 'Terminé',
};

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    COMPLETED: 'bg-forest-tint text-forest',
    FAILED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-amber-100 text-amber-800',
    CANCELLED: 'bg-gray-200 text-gray-700',
    UNDER_REVIEW: 'bg-gold/20 text-gold',
    REFUNDED: 'bg-gray-200 text-gray-700',
  };
  return (
    <span className={`pill ${tone[status] ?? 'bg-forest-tint text-forest'}`}>{human(status)}</span>
  );
}

export function Stepper({ side, status }: { side: string; status: string }) {
  const steps = CRYPTO_STEPS[side] ?? [];
  const idx = steps.indexOf(status);
  const bad = ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const done = idx >= 0 && i < idx;
        const active = i === idx;
        return (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-forest text-white' : active ? 'bg-gold text-ink' : 'bg-black/5 text-muted'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={active ? 'font-semibold text-ink' : 'text-muted'}>{LABELS[s] ?? human(s)}</span>
          </li>
        );
      })}
      {status === 'UNDER_REVIEW' && (
        <li className="text-sm font-medium text-gold">En revue manuelle — notre équipe vérifie.</li>
      )}
      {bad && <li className="text-sm font-medium text-red-600">Transaction {human(status)}.</li>}
    </ol>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-forest hover:underline">
      ← {children}
    </Link>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
