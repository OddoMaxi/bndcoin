import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

const ADMIN_TARGETS = [
  'WAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMED',
  'USDT_PROCESSING',
  'USDT_SENT',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'MANUAL_REVIEW',
] as const;

export class AdminTransitionDto {
  @IsIn(ADMIN_TARGETS as unknown as string[])
  toStatus!: (typeof ADMIN_TARGETS)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class ResolveReviewDto {
  @IsIn(['COMPLETE', 'FAIL', 'CANCEL', 'RETRY_USDT'])
  decision!: 'COMPLETE' | 'FAIL' | 'CANCEL' | 'RETRY_USDT';

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class ListTransactionsQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
