import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { CreateQuoteDto } from './dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Idempotent()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('quotes')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(userId, dto);
  }

  @Get('quotes')
  list(@CurrentUser('id') userId: string) {
    return this.quotes.listForUser(userId);
  }

  @Get('quotes/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.quotes.getDto(id, userId);
  }

  @Roles('ADMIN', 'TREASURY_OPS', 'COMPLIANCE')
  @Get('admin/quotes')
  adminList(@Query('status') status?: string) {
    return this.quotes.adminList(status);
  }
}
