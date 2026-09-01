import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN', 'TREASURY_OPS', 'COMPLIANCE'])
  role?: 'USER' | 'ADMIN' | 'TREASURY_OPS' | 'COMPLIANCE';

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_KYC'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_KYC';

  @IsOptional()
  @IsIn(['NONE', 'BASIC', 'FULL'])
  kycLevel?: 'NONE' | 'BASIC' | 'FULL';
}

export class ListUsersQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  search?: string;
}
