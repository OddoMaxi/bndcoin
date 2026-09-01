export const QUEUE = {
  BUY_FLOW: 'buy-flow',
  QUOTES: 'quotes',
} as const;

export const BUY_FLOW_JOB = {
  PAYMENT_TIMEOUT: 'payment-timeout',
  CONFIRM_USDT: 'confirm-usdt',
} as const;

export const QUOTES_JOB = {
  SWEEP_EXPIRED: 'sweep-expired',
} as const;

export interface PaymentTimeoutJob {
  transactionId: string;
}
export interface ConfirmUsdtJob {
  transactionId: string;
  attempt: number;
}
