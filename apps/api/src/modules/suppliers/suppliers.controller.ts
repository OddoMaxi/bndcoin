import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { InventoryService } from './inventory.service';
import { SuppliersService } from './suppliers.service';

class CreateSupplierDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class CreatePurchaseDto {
  @IsString() supplierId!: string;
  @Matches(/^\d+(\.\d+)?$/) quantityUsdt!: string;
  @Matches(/^\d+(\.\d+)?$/) purchaseAmount!: string;
  @IsOptional() @IsString() network?: string;
  @IsOptional() @IsString() txHash?: string;
  @IsOptional() @IsString() paymentReference?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class PurchaseStatusDto {
  @IsIn(['CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING']) status!: 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'PENDING';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

@ApiTags('suppliers')
@RequirePermission('suppliers.read')
@Controller('admin/suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly inventory: InventoryService,
  ) {}

  @Get()
  list() {
    return this.suppliers.listSuppliers();
  }

  @Get('inventory')
  inventorySummary() {
    return this.inventory.inventorySummary();
  }

  @Get('purchases')
  purchases() {
    return this.suppliers.listPurchases();
  }

  @RequirePermission('suppliers.write')
  @Post()
  create(@CurrentUser('id') actorId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.createSupplier(actorId, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('suppliers.write')
  @Patch(':id')
  update(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) {
    return this.suppliers.updateSupplier(actorId, id, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('suppliers.write')
  @Post('purchases')
  createPurchase(@CurrentUser('id') actorId: string, @Body() dto: CreatePurchaseDto) {
    return this.suppliers.createPurchase(actorId, dto as unknown as Record<string, unknown>);
  }

  @RequirePermission('suppliers.write')
  @Post('purchases/:id/status')
  setStatus(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: PurchaseStatusDto,
  ) {
    return this.suppliers.setPurchaseStatus(actorId, id, dto.status, dto.reason);
  }
}
