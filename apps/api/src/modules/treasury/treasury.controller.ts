import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { LedgerService } from '../../common/ledger/ledger.service';
import { TreasuryService } from './treasury.service';

class AdjustDto {
  @IsIn(['GNF', 'USDT']) asset!: 'GNF' | 'USDT';
  @IsString() @MaxLength(20) bucket!: string;
  @IsIn(['CREDIT', 'DEBIT']) direction!: 'CREDIT' | 'DEBIT';
  @Matches(/^\d+(\.\d+)?$/) amount!: string;
  @IsString() @MaxLength(200) memo!: string;
}
class MovesQuery extends PaginationQuery {
  asset?: string;
  bucket?: string;
}

@ApiTags('treasury')
@Controller('admin/treasury')
export class TreasuryController {
  constructor(
    private readonly treasury: TreasuryService,
    private readonly ledger: LedgerService,
  ) {}

  @RequirePermission('treasury.read')
  @Get()
  async overview() {
    const [balances, reservations, reconcile] = await Promise.all([
      this.treasury.getBalances(),
      this.treasury.openReservations(),
      this.treasury.reconcile(),
    ]);
    return { balances, reservations, reconcile };
  }

  @RequirePermission('treasury.read')
  @Get('movements')
  movements(@Query() q: MovesQuery) {
    return this.treasury.listMovements(q);
  }

  @RequirePermission('ledger.read')
  @Get('ledger')
  async ledgerTrialBalance() {
    const [trial, integrity] = await Promise.all([
      this.ledger.trialBalance(),
      this.ledger.integrityCheck(),
    ]);
    return { trialBalance: trial, integrity };
  }

  @RequirePermission('treasury.write')
  @Idempotent()
  @Post('adjust')
  adjust(@CurrentUser('id') actorId: string, @Body() dto: AdjustDto) {
    return this.treasury.adjust(actorId, dto.asset, dto.bucket, dto.direction, dto.amount, dto.memo);
  }
}
