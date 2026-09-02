import { InventoryService } from './inventory.service';

/** Fake prisma/tx backed by an in-memory lot array. */
function makeSvc(lots: any[]) {
  const store = lots.map((l, i) => ({ id: `lot-${i}`, asset: 'USDT', ...l }));
  const client = {
    inventoryLot: {
      findMany: jest.fn(async ({ where }: any) => {
        let out = store;
        if (where?.quantityRemaining?.gt !== undefined) out = out.filter((l) => Number(l.quantityRemaining) > 0);
        return out.map((l) => ({ ...l, quantityRemaining: { toFixed: () => String(l.quantityRemaining) }, unitCostGnf: { toFixed: () => String(l.unitCostGnf) } }));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const lot = store.find((l) => l.id === where.id)!;
        lot.quantityRemaining = data.quantityRemaining;
      }),
      create: jest.fn(),
    },
    cryptoOrder: { aggregate: jest.fn(async () => ({ _sum: { marginGnf: null } })) },
  };
  return { svc: new InventoryService(client as any), client, store };
}

describe('InventoryService (weighted average cost + FIFO COGS)', () => {
  it('computes the weighted average acquisition cost across lots', async () => {
    const { svc, client } = makeSvc([
      { quantityRemaining: '5000', unitCostGnf: '8800' },
      { quantityRemaining: '10000', unitCostGnf: '8900' },
      { quantityRemaining: '5000', unitCostGnf: '8750' },
    ]);
    // (5000*8800 + 10000*8900 + 5000*8750) / 20000 = 8837.5
    expect(await svc.weightedAverageCost()).toBe('8837.5');
  });

  it('consumes lots FIFO and returns the realized COGS', async () => {
    const { svc, client } = makeSvc([
      { quantityRemaining: '100', unitCostGnf: '8000' },
      { quantityRemaining: '100', unitCostGnf: '9000' },
    ]);
    // take 150: 100@8000 + 50@9000 = 800000 + 450000 = 1,250,000
    const cogs = await svc.consumeFifo(client as any, '150', '9500');
    expect(cogs).toBe('1250000');
  });

  it('costs the shortfall at the fallback rate when inventory is short', async () => {
    const { svc, client } = makeSvc([{ quantityRemaining: '50', unitCostGnf: '8000' }]);
    // take 100: 50@8000 + 50@9500(fallback) = 400000 + 475000 = 875000
    const cogs = await svc.consumeFifo(client as any, '100', '9500');
    expect(cogs).toBe('875000');
  });

  it('returns 0 WAC when there is no inventory', async () => {
    const { svc, client } = makeSvc([]);
    expect(await svc.weightedAverageCost()).toBe('0');
  });
});
