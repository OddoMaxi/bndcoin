import {
  ActorType,
  Asset,
  KycLevel,
  PaymentMethod,
  QuoteStatus,
  Role,
  TradingPair,
  TransactionStatus,
  TransactionType,
  UserStatus,
} from './enums';

/** All monetary values cross the wire as canonical decimal strings, never numbers. */
export type DecimalString = string;
export type IsoDateString = string;

export interface UserDto {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  kycLevel: KycLevel;
  createdAt: IsoDateString;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto extends AuthTokensDto {
  user: UserDto;
}

export interface PricingDto {
  pair: TradingPair;
  marketRate: DecimalString;
  buyRate: DecimalString;
  buySpreadBps: number;
  feeGnfFlat: DecimalString;
  minGnfAmount: DecimalString;
  maxGnfAmount: DecimalString;
  quoteTtlSeconds: number;
  version: number;
}

export interface QuoteDto {
  id: string;
  publicId: string;
  pair: TradingPair;
  side: TransactionType;
  status: QuoteStatus;
  marketRate: DecimalString;
  bnRate: DecimalString;
  spreadBps: number;
  feeGnf: DecimalString;
  gnfAmount: DecimalString;
  usdtAmount: DecimalString;
  expiresAt: IsoDateString;
  expiresInSeconds: number;
  transactionId: string | null;
  createdAt: IsoDateString;
}

export interface TransactionEventDto {
  id: string;
  previousStatus: TransactionStatus | null;
  nextStatus: TransactionStatus;
  event: string;
  actorType: ActorType;
  reason: string | null;
  createdAt: IsoDateString;
}

export interface TransactionDto {
  id: string;
  publicId: string;
  type: TransactionType;
  status: TransactionStatus;
  pair: TradingPair;
  marketRate: DecimalString;
  bnRate: DecimalString;
  feeGnf: DecimalString;
  gnfAmount: DecimalString;
  usdtAmount: DecimalString;
  destinationAddress: string;
  paymentMethod: PaymentMethod;
  paymentInstructions: PaymentInstructionsDto | null;
  cryptoTxHash: string | null;
  cryptoConfirmations: number;
  requiredConfirmations: number;
  failureReason: string | null;
  manualReviewReason: string | null;
  paymentExpiresAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  completedAt: IsoDateString | null;
  events: TransactionEventDto[];
}

export interface PaymentInstructionsDto {
  method: PaymentMethod;
  payToName: string;
  payToNumber: string;
  amount: DecimalString;
  currency: Asset;
  reference: string;
  expiresAt: IsoDateString;
}

export interface TreasuryBalanceDto {
  asset: Asset;
  available: DecimalString;
  reserved: DecimalString;
  total: DecimalString;
  updatedAt: IsoDateString;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorDto {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  requestId?: string;
}
