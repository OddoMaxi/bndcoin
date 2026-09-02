import { Injectable } from '@nestjs/common';
import { SupplyStatus } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { AlertsService } from '../../common/alerts/alerts.service';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { supplyPublicId } from '../../common/util/public-id';
import { TreasuryService } from '../treasury/treasury.service';
import { InventoryService } from './inventory.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly treasury: TreasuryService,
    private readonly inventory: InventoryService,
    private readonly alerts: AlertsService,
  ) {}

  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createSupplier(actorId: string, data: Record<string, unknown>) {
    const supplier = await this.prisma.supplier.create({
      data: {
        name: data.name as string,
        type: (data.type as string) ?? 'INDIVIDUAL',
        phone: data.phone as string,
        email: data.email as string,
        company: data.company as string,
        notes: data.notes as string,
      },
    });
    await this.audit.recordStandalone({
      action: 'supplier.created',
      entityType: 'Supplier',
      entityId: supplier.id,
      actorType: 'ADMIN',
      actorId,
      after: { name: supplier.name },
    });
    return supplier;
  }

  async updateSupplier(actorId: string, id: string, data: Record<string, unknown>) {
    const supplier = await this.prisma.supplier.update({ where: { id }, data });
    await this.audit.recordStandalone({
      action: 'supplier.updated',
      entityType: 'Supplier',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
      after: data,
    });
    return supplier;
  }

  async listPurchases() {
    return this.prisma.supplierPurchase.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true },
      take: 200,
    });
  }

  async createPurchase(actorId: string, data: Record<string, unknown>) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: data.supplierId as string } });
    if (!supplier) throw new NotFoundError('Supplier', data.supplierId as string);

    const quantity = Money.of(data.quantityUsdt as string, 'USDT').assertPositive('quantityUsdt');
    const purchaseAmount = Money.of(data.purchaseAmount as string, 'GNF').assertPositive('purchaseAmount');
    const unitCost = purchaseAmount.div(quantity.toPreciseString()).quantize('ROUND_HALF_UP');

    const purchase = await this.prisma.supplierPurchase.create({
      data: {
        publicId: supplyPublicId(),
        supplierId: supplier.id,
        quantityUsdt: quantity.toString(),
        purchaseCurrency: 'GNF',
        purchaseAmount: purchaseAmount.toString(),
        unitCostGnf: unitCost.toString(),
        network: data.network as string,
        txHash: data.txHash as string,
        paymentReference: data.paymentReference as string,
        notes: data.notes as string,
        status: 'PENDING',
        createdBy: actorId,
      },
    });
    await this.audit.recordStandalone({
      action: 'supply.created',
      entityType: 'SupplierPurchase',
      entityId: purchase.id,
      actorType: 'ADMIN',
      actorId,
      after: { quantityUsdt: quantity.toString(), unitCostGnf: unitCost.toString() },
    });
    return purchase;
  }

  async setPurchaseStatus(actorId: string, id: string, status: SupplyStatus, reason?: string) {
    const purchase = await this.prisma.supplierPurchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundError('SupplierPurchase', id);
    if (purchase.status === 'CONFIRMED') throw new ConflictError('ALREADY_CONFIRMED', 'Purchase already confirmed');
    if (!['CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING'].includes(status)) {
      throw new ValidationError('Invalid supply status');
    }

    if (status !== 'CONFIRMED') {
      await this.prisma.supplierPurchase.update({ where: { id }, data: { status } });
      await this.audit.recordStandalone({
        action: `supply.${status.toLowerCase()}`,
        entityType: 'SupplierPurchase',
        entityId: id,
        actorType: 'ADMIN',
        actorId,
        after: { status, reason },
      });
      return this.prisma.supplierPurchase.findUniqueOrThrow({ where: { id } });
    }

    // CONFIRMED: create inventory lot + credit USDT cold storage + ledger.
    await this.prisma.runInTransaction(async (tx) => {
      await tx.supplierPurchase.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      await this.inventory.addLot(tx, {
        sourceType: 'SUPPLIER_PURCHASE',
        sourceRef: purchase.publicId,
        purchaseId: purchase.id,
        quantity: purchase.quantityUsdt.toFixed(),
        unitCostGnf: purchase.unitCostGnf.toFixed(),
      });
      await this.treasury.creditAvailable(tx, {
        asset: 'USDT',
        bucket: 'COLD',
        amount: purchase.quantityUsdt.toFixed(),
        refType: 'supplier_purchase',
        refId: purchase.id,
        memo: `supply ${purchase.publicId}`,
      });
      // USDT enters cold storage; procurement cash is settled off-platform in V1,
      // so the balancing entry is the treasury-adjustment contra account. The GNF
      // cost basis lives in InventoryLot and is realised as COGS on sale.
      await this.ledger.post(tx, {
        reference: `supplier_purchase:${purchase.publicId}`,
        referenceType: 'supplier_purchase',
        referenceId: purchase.id,
        memo: `Confirmed supply from ${purchase.supplierId}`,
        createdBy: actorId,
        lines: [
          { account: 'USDT_COLD_STORAGE', currency: 'USDT', direction: 'DEBIT', amount: purchase.quantityUsdt.toFixed() },
          { account: 'TREASURY_ADJUSTMENT_USDT', currency: 'USDT', direction: 'CREDIT', amount: purchase.quantityUsdt.toFixed() },
        ],
      });
      await this.audit.record(tx, {
        action: 'supply.confirmed',
        entityType: 'SupplierPurchase',
        entityId: id,
        actorType: 'ADMIN',
        actorId,
        after: { quantityUsdt: purchase.quantityUsdt.toFixed() },
      });
    });
    await this.checkStockLevels();
    return this.prisma.supplierPurchase.findUniqueOrThrow({ where: { id } });
  }

  async checkStockLevels() {
    const summary = await this.inventory.inventorySummary();
    const remaining = Money.of(summary.quantityRemainingUsdt, 'USDT');
    const threshold = await this.prisma.setting.findUnique({ where: { key: 'usdt_low_threshold' } });
    const min = Money.of((threshold?.value as string) ?? '2000', 'USDT');
    if (remaining.lt(min)) {
      await this.alerts.raise('WARNING', 'USDT_LOW', `USDT inventory ${remaining.toString()} below threshold ${min.toString()}`);
    }
  }
}
