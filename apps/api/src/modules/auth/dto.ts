import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const GN_PHONE = /^\+224\d{8,10}$/;

export class RegisterDto {
  @Matches(GN_PHONE, { message: 'phone must be a Guinea number in E.164 form, e.g. +224620000000' })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LoginDto {
  @Matches(GN_PHONE)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
