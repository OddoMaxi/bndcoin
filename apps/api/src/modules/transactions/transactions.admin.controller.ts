import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/rbac/decorators';
import { AdminTransitionDto, ListTransactionsQuery, ResolveReviewDto } from './dto';
import { TransactionsService } from './transactions.service';

@ApiTags('admin/transactions')
@Roles('ADMIN', 'TREASURY_OPS', 'COMPLIANCE')
@Controller('admin/transactions')
export class TransactionsAdminController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Query() q: ListTransactionsQuery) {
    return this.transactions.adminList(q);
  }

  @Get('review-queue')
  reviewQueue() {
    return this.transactions.manualReviewQueue();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.transactions.getDto(id, undefined, true);
  }

  @Roles('ADMIN', 'TREASURY_OPS')
  @Post(':id/transition')
  transition(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminTransitionDto,
  ) {
    return this.transactions.adminTransition(actorId, id, dto);
  }

  @Roles('ADMIN', 'TREASURY_OPS', 'COMPLIANCE')
  @Post(':id/review/resolve')
  resolve(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: ResolveReviewDto,
  ) {
    return this.transactions.resolveReview(actorId, id, dto);
  }
}
