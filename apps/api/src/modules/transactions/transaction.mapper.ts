import { Transaction, TransactionEvent } from '@prisma/client';
import { PaymentInstructionsDto, TransactionDto, TransactionEventDto } from '@bn/shared-types';
import { toMoneyString, decimalToString } from '../../common/util/decimal';

const PAYMENT_STATUSES = new Set(['WAITING_PAYMENT', 'PAYMENT_DETECTED']);

const MERCHANT = {
  payToName: 'Bory & Norbert',
  payToNumber: '+224 611 00 00 00',
};

export function toTransactionEventDto(e: TransactionEvent): TransactionEventDto {
  return {
    id: e.id,
    previousStatus: e.previousStatus,
    nextStatus: e.nextStatus,
    event: e.event,
    actorType: e.actorType,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  };
}

function paymentInstructions(tx: Transaction): PaymentInstructionsDto | null {
  if (!PAYMENT_STATUSES.has(tx.status) || !tx.paymentExpiresAt) return null;
  return {
    method: tx.paymentMethod,
    payToName: MERCHANT.payToName,
    payToNumber: MERCHANT.payToNumber,
    amount: toMoneyString(tx.gnfAmount, 'GNF'),
    currency: 'GNF',
    reference: tx.publicId,
    expiresAt: tx.paymentExpiresAt.toISOString(),
  };
}

export function toTransactionDto(
  tx: Transaction & { events?: TransactionEvent[] },
  requiredConfirmations: number,
): TransactionDto {
  return {
    id: tx.id,
    publicId: tx.publicId,
    type: tx.type,
    status: tx.status,
    pair: tx.pair,
    marketRate: decimalToString(tx.marketRate),
    bnRate: decimalToString(tx.bnRate),
    feeGnf: toMoneyString(tx.feeGnf, 'GNF'),
    gnfAmount: toMoneyString(tx.gnfAmount, 'GNF'),
    usdtAmount: toMoneyString(tx.usdtAmount, 'USDT'),
    destinationAddress: tx.destinationAddress,
    paymentMethod: tx.paymentMethod,
    paymentInstructions: paymentInstructions(tx),
    cryptoTxHash: tx.cryptoTxHash,
    cryptoConfirmations: tx.cryptoConfirmations,
    requiredConfirmations,
    failureReason: tx.failureReason,
    manualReviewReason: tx.manualReviewReason,
    paymentExpiresAt: tx.paymentExpiresAt ? tx.paymentExpiresAt.toISOString() : null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    completedAt: tx.completedAt ? tx.completedAt.toISOString() : null,
    events: (tx.events ?? []).map(toTransactionEventDto),
  };
}
