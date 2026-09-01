/**
 * String enums shared between the API and the web client. Values are identical
 * to the Prisma enums on the API side; keeping a framework-free copy here means
 * the frontend never imports the Prisma client.
 */

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  TREASURY_OPS: 'TREASURY_OPS',
  COMPLIANCE: 'COMPLIANCE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_KYC: 'PENDING_KYC',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const KycLevel = {
  NONE: 'NONE',
  BASIC: 'BASIC',
  FULL: 'FULL',
} as const;
export type KycLevel = (typeof KycLevel)[keyof typeof KycLevel];

export const Asset = {
  GNF: 'GNF',
  USDT: 'USDT',
} as const;
export type Asset = (typeof Asset)[keyof typeof Asset];

export const TradingPair = {
  GNF_USDT: 'GNF_USDT',
} as const;
export type TradingPair = (typeof TradingPair)[keyof typeof TradingPair];

export const QuoteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const TransactionType = {
  BUY: 'BUY',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  CREATED: 'CREATED',
  QUOTE_LOCKED: 'QUOTE_LOCKED',
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  PAYMENT_DETECTED: 'PAYMENT_DETECTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  USDT_PROCESSING: 'USDT_PROCESSING',
  USDT_SENT: 'USDT_SENT',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TERMINAL_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.COMPLETED,
  TransactionStatus.EXPIRED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELLED,
];

export const ActorType = {
  SYSTEM: 'SYSTEM',
  USER: 'USER',
  ADMIN: 'ADMIN',
  PROVIDER: 'PROVIDER',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const PaymentMethod = {
  ORANGE_MONEY: 'ORANGE_MONEY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Scenarios an admin/dev can push into the mock payment provider. */
export const PaymentScenario = {
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DELAYED: 'DELAYED',
  TIMEOUT: 'TIMEOUT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
} as const;
export type PaymentScenario = (typeof PaymentScenario)[keyof typeof PaymentScenario];

/** Scenarios an admin/dev can push into the mock crypto provider. */
export const CryptoScenario = {
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
} as const;
export type CryptoScenario = (typeof CryptoScenario)[keyof typeof CryptoScenario];

export const ReservationStatus = {
  HELD: 'HELD',
  RELEASED: 'RELEASED',
  CONSUMED: 'CONSUMED',
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];
