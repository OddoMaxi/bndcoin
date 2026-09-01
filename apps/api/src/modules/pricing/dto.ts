import { IsInt, IsOptional, IsPositive, Matches, Max, Min } from 'class-validator';

const DECIMAL = /^\d+(\.\d+)?$/;

export class UpdatePricingDto {
  @Matches(DECIMAL, { message: 'marketRate must be a positive decimal string' })
  marketRate!: string;

  @IsInt()
  @Min(0)
  @Max(5000)
  buySpreadBps!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  sellSpreadBps?: number;

  @IsOptional()
  @Matches(DECIMAL)
  feeGnfFlat?: string;

  @Matches(DECIMAL)
  minGnfAmount!: string;

  @Matches(DECIMAL)
  maxGnfAmount!: string;

  @IsInt()
  @IsPositive()
  @Max(3600)
  quoteTtlSeconds!: number;
}
