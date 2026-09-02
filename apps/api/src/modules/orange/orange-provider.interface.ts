export const ORANGE_PROVIDER = Symbol('ORANGE_PROVIDER');

export interface OrangeCollectRequest {
  intentId: string;
  modemId: string;
  amount: string;
  customerPhone?: string;
  reference: string;
}
export interface OrangeCollectResult {
  externalReference: string;
  accepted: boolean;
  raw?: unknown;
}
export interface OrangePayoutRequest {
  payoutId: string;
  modemId: string;
  amount: string;
  toPhone: string;
  reference: string;
}
export interface OrangePayoutResult {
  externalReference: string;
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  raw?: unknown;
}
export interface OrangeStatusResult {
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  amount?: string;
  sender?: string;
  reference?: string;
  raw?: unknown;
}

/**
 * The gateway is a pure communication boundary. It never decides whether a
 * transaction is financially valid — that is the reconciliation engine's job.
 */
export interface OrangeMoneyProvider {
  readonly key: string;
  initiateCollect(req: OrangeCollectRequest): Promise<OrangeCollectResult>;
  initiatePayout(req: OrangePayoutRequest): Promise<OrangePayoutResult>;
  checkStatus(externalReference: string): Promise<OrangeStatusResult>;
  modemHealth(modemId: string): Promise<{ online: boolean; balanceGnf?: string }>;
}
