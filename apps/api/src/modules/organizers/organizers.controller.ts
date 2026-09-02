import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { OrganizersService } from './organizers.service';

class ApplyDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() payoutMsisdn?: string;
}
class OrgStatusDto {
  @IsIn(['APPROVED', 'SUSPENDED', 'PENDING']) status!: 'APPROVED' | 'SUSPENDED' | 'PENDING';
  @IsOptional() @IsString() commissionPct?: string;
}

@ApiTags('organizers')
@Controller()
export class OrganizersController {
  constructor(private readonly organizers: OrganizersService) {}

  @Post('organizer/apply')
  apply(@CurrentUser('id') userId: string, @Body() dto: ApplyDto) {
    return this.organizers.apply(userId, dto.name, dto.contactEmail, dto.payoutMsisdn);
  }

  @Get('organizer/me')
  mine(@CurrentUser('id') userId: string) {
    return this.organizers.mine(userId);
  }

  @Get('organizer/dashboard')
  dashboard(@CurrentUser('id') userId: string) {
    return this.organizers.dashboard(userId);
  }

  @RequirePermission('organizers.read')
  @Get('admin/organizers')
  adminList() {
    return this.organizers.listAll();
  }

  @RequirePermission('organizers.write')
  @Post('admin/organizers/:id/status')
  setStatus(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: OrgStatusDto) {
    return this.organizers.setStatus(actorId, id, dto.status, dto.commissionPct);
  }
}
