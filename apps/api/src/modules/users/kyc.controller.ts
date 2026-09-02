import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { KycService } from './kyc.service';

class KycSubmitDto {
  @IsString() @MaxLength(40) identityDocumentType!: string;
  @IsString() @MaxLength(60) identityDocumentNumber!: string;
  @IsString() @MaxLength(400) identityDocumentFront!: string;
  @IsOptional() @IsString() @MaxLength(400) identityDocumentBack?: string;
  @IsOptional() @IsString() @MaxLength(400) selfie?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
}

class KycReviewDto {
  @IsIn(['VERIFIED', 'REJECTED', 'SUSPENDED', 'PENDING']) decision!: 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'PENDING';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class KycListQuery extends PaginationQuery {
  @IsOptional() @IsString() status?: string;
}

@ApiTags('kyc')
@Controller()
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('kyc/me')
  mine(@CurrentUser('id') userId: string) {
    return this.kyc.getMine(userId);
  }

  @Post('kyc/submit')
  submit(@CurrentUser('id') userId: string, @Body() dto: KycSubmitDto) {
    return this.kyc.submit(userId, dto);
  }

  @RequirePermission('kyc.read')
  @Get('admin/kyc')
  adminList(@Query() q: KycListQuery) {
    return this.kyc.adminList(q);
  }

  @RequirePermission('kyc.review')
  @Post('admin/kyc/:id/review')
  review(@CurrentUser('id') reviewerId: string, @Param('id') id: string, @Body() dto: KycReviewDto) {
    return this.kyc.review(reviewerId, id, dto.decision, dto.reason);
  }
}
