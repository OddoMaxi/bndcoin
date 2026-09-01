import { Quote } from '@prisma/client';
import { QuoteDto } from '@bn/shared-types';
import { toMoneyString, decimalToString } from '../../common/util/decimal';

export function toQuoteDto(quote: Quote): QuoteDto {
  const expiresInSeconds = Math.max(
    0,
    Math.floor((quote.expiresAt.getTime() - Date.now()) / 1000),
  );
  return {
    id: quote.id,
    publicId: quote.publicId,
    pair: quote.pair,
    side: quote.side,
    status: quote.status,
    marketRate: decimalToString(quote.marketRate),
    bnRate: decimalToString(quote.bnRate),
    spreadBps: quote.spreadBps,
    feeGnf: toMoneyString(quote.feeGnf, 'GNF'),
    gnfAmount: toMoneyString(quote.gnfAmount, 'GNF'),
    usdtAmount: toMoneyString(quote.usdtAmount, 'USDT'),
    expiresAt: quote.expiresAt.toISOString(),
    expiresInSeconds,
    transactionId: quote.transactionId,
    createdAt: quote.createdAt.toISOString(),
  };
}
