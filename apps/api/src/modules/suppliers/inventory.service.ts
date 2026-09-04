import { Injectable } from '@nestjs/common';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../../common/prisma/prisma.service';

/**
 * USDT inventory cost basis. Lots are created on confirmed supplier purchases
 * (and on completed SELL orders, where the platform acquires USDT from a user).
 * BUY orders consume lots FIFO, producing a realized cost of goods sold.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async weightedAverageCost(): Promise<string> {
    const lots = await this.prisma.inventoryLot.findMany({
      where: { asset: 'USDT', quantityRemaining: { gt: 0 } },
    });
    if (lots.length === 0) return '0';
    let qty = Money.zero('USDT');
    let cost = Money.zero('GNF');
    for (const l of lots) {
      const q = Money.of(l.quantityRemaining.toFixed(), 'USDT');
      qty = qty.add(q);
      cost = cost.add(Money.of(q.toPreciseString(), 'GNF').mul(l.unitCostGnf.toFixed()));
    }
    if (qty.isZero()) return '0';
    // A cost basis rate — keep sub-franc precision (6 dp), don't quantise to whole GNF.
    return cost.div(qty.toPreciseString()).decimal.toDecimalPlaces(6).toFixed().replace(/\.?0+$/, '') || '0';
  }

  async inventorySummary() {
    const lots = await this.prisma.inventoryLot.findMany({ where: { asset: 'USDT' } });
    const remaining = lots.reduce((m, l) => m.add(Money.of(l.quantityRemaining.toFixed(), 'USDT')), Money.zero('USDT'));
    const wac = await this.weightedAverageCost();
    const valuationGnf = Money.of(remaining.toPreciseString(), 'GNF').mul(wac).quantize().toString();
    const realized = await this.prisma.cryptoOrder.aggregate({
      where: { side: 'BUY_USDT', status: 'COMPLETED' },
      _sum: { marginGnf: true },
    });
    return {
      quantityRemainingUsdt: remaining.toString(),
      weightedAverageCostGnf: wac,
      inventoryValuationGnf: valuationGnf,
      realizedMarginGnf: realized._sum.marginGnf?.toFixed() ?? '0',
      lotCount: lots.length,
    };
  }

  /** Add a lot (confirmed purchase, or USDT acquired from a completed SELL). */
  async addLot(
    tx: Tx,
    params: {
      sourceType: 'SUPPLIER_PURCHASE' | 'SELL_ORDER';
      sourceRef: string;
      purchaseId?: string;
      quantity: string;
      unitCostGnf: string;
    },
  ): Promise<void> {
    await tx.inventoryLot.create({
      data: {
        sourceType: params.sourceType,
        sourceRef: params.sourceRef,
        purchaseId: params.purchaseId,
        asset: 'USDT',
        quantity: Money.of(params.quantity, 'USDT').toString(),
        quantityRemaining: Money.of(params.quantity, 'USDT').toString(),
        unitCostGnf: Money.of(params.unitCostGnf, 'GNF').toString(),
      },
    });
  }

  /**
   * Consume `quantityUsdt` FIFO across lots; returns the realized COGS in GNF.
   * If inventory is short, the shortfall is costed at the fallback rate.
   */
  async consumeFifo(tx: Tx, quantityUsdt: string, fallbackUnitCostGnf: string): Promise<string> {
    let need = Money.of(quantityUsdt, 'USDT');
    let cogs = Money.zero('GNF');
    const lots = await tx.inventoryLot.findMany({
      where: { asset: 'USDT', quantityRemaining: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
    for (const lot of lots) {
      if (!need.isPositive()) break;
      const avail = Money.of(lot.quantityRemaining.toFixed(), 'USDT');
      const take = avail.lte(need) ? avail : need;
      cogs = cogs.add(Money.of(take.toPreciseString(), 'GNF').mul(lot.unitCostGnf.toFixed()));
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: { quantityRemaining: avail.sub(take).toString() },
      });
      need = need.sub(take);
    }
    if (need.isPositive()) {
      cogs = cogs.add(Money.of(need.toPreciseString(), 'GNF').mul(fallbackUnitCostGnf));
    }
    return cogs.quantize().toString();
  }
}
