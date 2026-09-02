import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { TreasuryService } from '../../modules/treasury/treasury.service';

/** Idempotent structural setup run on every boot (chart of accounts, treasury buckets). */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger('Bootstrap');

  constructor(
    private readonly ledger: LedgerService,
    private readonly treasury: TreasuryService,
  ) {}

  async onModuleInit() {
    await this.ledger.ensureChartOfAccounts();
    await this.treasury.ensureAccounts();
    this.logger.log('Chart of accounts and treasury buckets ensured');
  }
}
