import { Module } from '@nestjs/common';
import { TreasuryModule } from '../treasury/treasury.module';
import { InventoryService } from './inventory.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [TreasuryModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, InventoryService],
  exports: [SuppliersService, InventoryService],
})
export class SuppliersModule {}
