import { IsIn, IsOptional, Matches } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsIn(['GNF_USDT'])
  pair?: string;

  @IsOptional()
  @IsIn(['BUY'])
  side?: string;

  @Matches(/^\d+$/, { message: 'gnfAmount must be a whole number of GNF' })
  gnfAmount!: string;
}

export class AcceptQuoteDto {
  @Matches(/^(T[1-9A-HJ-NP-Za-km-z]{33}|0x[0-9a-fA-F]{40})$/, {
    message: 'destinationAddress must be a valid TRON (T...) or EVM (0x...) USDT address',
  })
  destinationAddress!: string;
}
