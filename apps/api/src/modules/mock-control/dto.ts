import { IsIn, IsOptional, IsString } from 'class-validator';

export class MockPaymentEventDto {
  @IsIn(['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'DELAYED', 'TIMEOUT', 'INSUFFICIENT_BALANCE'])
  scenario!: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'DELAYED' | 'TIMEOUT' | 'INSUFFICIENT_BALANCE';
}

export class MockCryptoEventDto {
  @IsIn(['SENT', 'CONFIRMED', 'FAILED'])
  scenario!: 'SENT' | 'CONFIRMED' | 'FAILED';
}

export class MockScenariosDto {
  @IsString()
  transactionId!: string;

  @IsOptional()
  @IsIn(['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'DELAYED', 'TIMEOUT', 'INSUFFICIENT_BALANCE'])
  paymentScenario?: string;

  @IsOptional()
  @IsIn(['SENT', 'CONFIRMED', 'FAILED'])
  cryptoScenario?: string;
}
