export const CRYPTO_PROVIDER = Symbol('CRYPTO_PROVIDER');

export interface SendUsdtRequest {
  transactionId: string;
  toAddress: string;
  /** USDT amount, canonical decimal string. */
  amount: string;
  /** Stable key so retries never double-send. */
  idempotencyKey: string;
}

export interface SendUsdtResult {
  txHash: string;
  status: 'BROADCAST' | 'FAILED';
  raw?: unknown;
}

export interface CryptoTransactionResult {
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  confirmations: number;
  raw?: unknown;
}

/**
 * Abstraction over an on-chain USDT sender. The application never imports a
 * concrete chain SDK — only this interface.
 */
export interface CryptoProvider {
  readonly key: string;
  sendUSDT(req: SendUsdtRequest): Promise<SendUsdtResult>;
  getTransaction(txHash: string): Promise<CryptoTransactionResult>;
  getBalance(): Promise<{ asset: 'USDT'; available: string }>;
  validateAddress(address: string): boolean;
}
