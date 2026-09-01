import { Module } from '@nestjs/common';
import { TreasuryModule } from '../treasury/treasury.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [TreasuryModule],
  controllers: [AdminController],
})
export class AdminModule {}
