import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { LedgerQuery, TreasuryAdjustDto } from './dto';
import { TreasuryService } from './treasury.service';

@ApiTags('treasury')
@Roles('ADMIN', 'TREASURY_OPS')
@Controller('admin/treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  async overview() {
    const [balances, reservations] = await Promise.all([
      this.treasury.getBalances(),
      this.treasury.openReservationsSummary(),
    ]);
    return { balances, reservations };
  }

  @Get('ledger')
  ledger(@Query() q: LedgerQuery) {
    return this.treasury.listLedger(q);
  }

  @Idempotent()
  @Post('adjust')
  adjust(@CurrentUser('id') actorId: string, @Body() dto: TreasuryAdjustDto) {
    return this.treasury.adjust(actorId, dto);
  }
}
