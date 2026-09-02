import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { UsersService } from './users.service';

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
}

class AdminUpdateUserDto {
  @IsOptional() @IsIn(['SUPER_ADMIN', 'OPERATIONS', 'TREASURY', 'COMPLIANCE', 'CUSTOMER_SUPPORT', 'EVENT_MANAGER', 'FINANCE', 'AUDITOR', 'ORGANIZER', 'SCANNER_OPERATOR', 'CUSTOMER'])
  role?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_KYC', 'CLOSED']) status?: string;
  @IsOptional() @IsIn(['NONE', 'BASIC', 'FULL']) kycLevel?: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) riskLevel?: string;
}

class ListUsersQuery extends PaginationQuery {
  @IsOptional() @IsString() search?: string;
}

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users/me')
  me(@CurrentUser('id') id: string) {
    return this.users.getById(id);
  }

  @Patch('users/me')
  updateMe(@CurrentUser('id') id: string, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(id, dto as unknown as Record<string, unknown>);
  }

  @Get('users/me/limits')
  limits(@CurrentUser('id') id: string) {
    return this.users.getLimitsDto(id);
  }

  @RequirePermission('users.read')
  @Get('admin/users')
  adminList(@Query() q: ListUsersQuery) {
    return this.users.adminList(q);
  }

  @RequirePermission('users.read')
  @Get('admin/users/:id')
  adminGet(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @RequirePermission('users.write')
  @Patch('admin/users/:id')
  adminUpdate(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.adminUpdate(actorId, id, dto as unknown as Record<string, unknown>);
  }
}
