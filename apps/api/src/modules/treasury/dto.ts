import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

export class TreasuryAdjustDto {
  @IsIn(['GNF', 'USDT'])
  asset!: 'GNF' | 'USDT';

  @IsIn(['CREDIT', 'DEBIT'])
  direction!: 'CREDIT' | 'DEBIT';

  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;

  @IsString()
  @MaxLength(200)
  memo!: string;
}

export class LedgerQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['GNF', 'USDT'])
  asset?: 'GNF' | 'USDT';
}
