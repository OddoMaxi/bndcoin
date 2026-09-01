'use client';

import Link from 'next/link';
import { BUY_HAPPY_PATH, TERMINAL_TRANSACTION_STATUSES } from '@bn/shared-types';
import { humanStatus } from '@/lib/format';

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    COMPLETED: 'bg-forest-tint text-forest',
    FAILED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-amber-100 text-amber-800',
    CANCELLED: 'bg-gray-200 text-gray-700',
    MANUAL_REVIEW: 'bg-gold-soft text-ink',
    PENDING: 'bg-forest-tint text-forest',
    ACCEPTED: 'bg-forest-tint text-forest',
  };
  return (
    <span className={`pill ${tone[status] ?? 'bg-forest-tint text-forest'}`}>
      {humanStatus(status)}
    </span>
  );
}

const STEP_LABELS: Record<string, string> = {
  QUOTE_LOCKED: 'Devis verrouillé',
  WAITING_PAYMENT: 'En attente du paiement',
  PAYMENT_DETECTED: 'Paiement détecté',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  USDT_PROCESSING: 'Envoi en préparation',
  USDT_SENT: 'USDT envoyé',
  COMPLETED: 'Terminé',
};

export function StatusStepper({ status }: { status: string }) {
  const isTerminalBad = ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status);
  const currentIndex = BUY_HAPPY_PATH.indexOf(status as (typeof BUY_HAPPY_PATH)[number]);

  return (
    <ol className="space-y-3">
      {BUY_HAPPY_PATH.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? 'bg-forest text-white'
                  : active
                    ? 'bg-gold text-ink'
                    : 'bg-black/5 text-muted'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={active ? 'font-semibold text-ink' : 'text-muted'}>
              {STEP_LABELS[step]}
            </span>
          </li>
        );
      })}
      {status === 'MANUAL_REVIEW' && (
        <li className="text-sm font-medium text-gold">
          En revue manuelle — notre équipe vérifie cette transaction.
        </li>
      )}
      {isTerminalBad && (
        <li className="text-sm font-medium text-red-600">Transaction {humanStatus(status)}.</li>
      )}
    </ol>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-muted">{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-forest hover:underline">
      ← {children}
    </Link>
  );
}

export { TERMINAL_TRANSACTION_STATUSES };
