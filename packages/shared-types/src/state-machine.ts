import { TransactionStatus, TERMINAL_TRANSACTION_STATUSES } from './enums';

/**
 * Authoritative BUY transaction transition table. The API enforces this on the
 * server; the web client uses it only to render progress and disable actions.
 */
export const TRANSACTION_TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
  CREATED: ['QUOTE_LOCKED', 'CANCELLED', 'EXPIRED'],
  QUOTE_LOCKED: ['WAITING_PAYMENT', 'CANCELLED', 'EXPIRED'],
  WAITING_PAYMENT: ['PAYMENT_DETECTED', 'CANCELLED', 'EXPIRED', 'FAILED', 'MANUAL_REVIEW'],
  PAYMENT_DETECTED: ['PAYMENT_CONFIRMED', 'FAILED', 'MANUAL_REVIEW'],
  PAYMENT_CONFIRMED: ['USDT_PROCESSING', 'FAILED', 'MANUAL_REVIEW'],
  USDT_PROCESSING: ['USDT_SENT', 'FAILED', 'MANUAL_REVIEW'],
  USDT_SENT: ['COMPLETED', 'MANUAL_REVIEW'],
  MANUAL_REVIEW: ['USDT_PROCESSING', 'PAYMENT_CONFIRMED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  EXPIRED: [],
  FAILED: [],
  CANCELLED: [],
};

/** Ordered happy-path milestones, for progress steppers. */
export const BUY_HAPPY_PATH: readonly TransactionStatus[] = [
  'QUOTE_LOCKED',
  'WAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMED',
  'USDT_PROCESSING',
  'USDT_SENT',
  'COMPLETED',
];

export function isTerminalStatus(status: TransactionStatus): boolean {
  return TERMINAL_TRANSACTION_STATUSES.includes(status);
}

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSACTION_TRANSITIONS[from]?.includes(to) ?? false;
}
