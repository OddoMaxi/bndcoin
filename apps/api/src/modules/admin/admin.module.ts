import { Module } from '@nestjs/common';
import { TreasuryModule } from '../treasury/treasury.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [TreasuryModule, SuppliersModule],
  controllers: [AdminController],
})
export class AdminModule {}
