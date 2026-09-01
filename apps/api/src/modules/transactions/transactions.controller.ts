import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { AcceptQuoteDto } from '../quotes/dto';
import { ListTransactionsQuery } from './dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Idempotent()
  @Post('quotes/:id/accept')
  accept(
    @CurrentUser('id') userId: string,
    @Param('id') quoteId: string,
    @Body() dto: AcceptQuoteDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactions.acceptQuote(userId, quoteId, dto.destinationAddress, idempotencyKey);
  }

  @Get('transactions')
  list(@CurrentUser('id') userId: string, @Query() q: ListTransactionsQuery) {
    return this.transactions.listForUser(userId, q);
  }

  @Get('transactions/:id')
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.transactions.getDto(id, userId);
  }

  @Post('transactions/:id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.transactions.cancel(userId, id);
  }
}
