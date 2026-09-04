export const QUEUE = {
  CRYPTO: 'crypto',
  PAYMENTS: 'payments',
  ORANGE: 'orange',
  BLOCKCHAIN: 'blockchain',
  EVENTS: 'events',
  MAINTENANCE: 'maintenance',
} as const;

export const JOB = {
  // crypto
  BUY_START_PAYMENT: 'buy:start-payment',
  BUY_PAYMENT_TIMEOUT: 'buy:payment-timeout',
  SELL_WATCH_DEPOSIT: 'sell:watch-deposit',
  SELL_DEPOSIT_TIMEOUT: 'sell:deposit-timeout',
  WITHDRAWAL_CONFIRM: 'crypto:withdrawal-confirm',
  // payments
  PAYMENT_POLL: 'payment:poll',
  PAYOUT_PROCESS: 'payout:process',
  PAYOUT_CONFIRM: 'payout:confirm',
  // blockchain
  BLOCKCHAIN_SCAN: 'blockchain:scan',
  // maintenance
  QUOTE_SWEEP: 'maintenance:quote-sweep',
  ORDER_SWEEP: 'maintenance:order-sweep',
  CRYPTO_WATCH_SWEEP: 'maintenance:crypto-watch-sweep',
  TREASURY_RECONCILE: 'maintenance:treasury-reconcile',
  ALERT_SCAN: 'maintenance:alert-scan',
  MODEM_HEALTHCHECK: 'orange:modem-healthcheck',
} as const;
