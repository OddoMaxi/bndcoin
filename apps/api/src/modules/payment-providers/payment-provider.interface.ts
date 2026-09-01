export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CollectRequest {
  transactionId: string;
  /** GNF amount to collect, canonical decimal string. */
  amount: string;
  currency: 'GNF';
  payerPhone?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CollectResult {
  providerRef: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  raw?: unknown;
}

export interface PayoutRequest {
  transactionId: string;
  amount: string;
  currency: 'GNF';
  toPhone: string;
  idempotencyKey: string;
}

export interface PayoutResult {
  providerRef: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  raw?: unknown;
}

export type PaymentCheckStatus =
  | 'PENDING'
  | 'DETECTED'
  | 'SETTLED'
  | 'FAILED'
  | 'INSUFFICIENT_BALANCE'
  | 'EXPIRED';

export interface CheckTransactionResult {
  providerRef: string;
  status: PaymentCheckStatus;
  paidAmount?: string;
  raw?: unknown;
}

/**
 * Abstraction over a mobile-money / bank rail. The application never imports an
 * Orange Money (or any vendor) SDK — only this interface.
 */
export interface PaymentProvider {
  readonly key: string;
  collect(req: CollectRequest): Promise<CollectResult>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
  checkTransaction(providerRef: string): Promise<CheckTransactionResult>;
  getBalance(currency: 'GNF'): Promise<{ currency: 'GNF'; available: string }>;
}
