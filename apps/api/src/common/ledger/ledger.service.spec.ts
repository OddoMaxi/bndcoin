import { LedgerService, UnbalancedJournalError } from './ledger.service';

/** Minimal fake tx client capturing journal + entry creates. */
function fakeTx() {
  const entries: any[] = [];
  return {
    entries,
    tx: {
      ledgerAccount: { findUnique: jest.fn(async ({ where }: any) => ({ id: `acc-${where.code}`, code: where.code })) },
      ledgerJournal: { create: jest.fn(async ({ data }: any) => ({ id: 'j1', ...data })) },
      ledgerEntry: { create: jest.fn(async ({ data }: any) => entries.push(data)) },
    } as any,
  };
}

describe('LedgerService.post', () => {
  const svc = new LedgerService({} as any);

  it('accepts a balanced multi-currency journal and writes every entry', async () => {
    const { tx, entries } = fakeTx();
    await svc.post(tx, {
      reference: 'r',
      referenceType: 'test',
      referenceId: '1',
      lines: [
        { account: 'GNF_PDV_01', currency: 'GNF', direction: 'DEBIT', amount: '1000000' },
        { account: 'COGS_USDT', currency: 'GNF', direction: 'CREDIT', amount: '900000' },
        { account: 'TRADING_MARGIN', currency: 'GNF', direction: 'CREDIT', amount: '100000' },
        { account: 'USDT_HOT_WALLET', currency: 'USDT', direction: 'CREDIT', amount: '100' },
        { account: 'TREASURY_ADJUSTMENT_USDT', currency: 'USDT', direction: 'DEBIT', amount: '100' },
      ],
    });
    expect(entries).toHaveLength(5);
  });

  it('rejects an unbalanced journal (GNF debit != credit)', async () => {
    const { tx } = fakeTx();
    await expect(
      svc.post(tx, {
        reference: 'r',
        referenceType: 'test',
        referenceId: '2',
        lines: [
          { account: 'GNF_PDV_01', currency: 'GNF', direction: 'DEBIT', amount: '1000000' },
          { account: 'TRADING_MARGIN', currency: 'GNF', direction: 'CREDIT', amount: '999999' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalError);
  });

  it('rejects an imbalance in one currency of a mixed journal', async () => {
    const { tx } = fakeTx();
    await expect(
      svc.post(tx, {
        reference: 'r',
        referenceType: 'test',
        referenceId: '3',
        lines: [
          { account: 'GNF_PDV_01', currency: 'GNF', direction: 'DEBIT', amount: '100' },
          { account: 'TRADING_MARGIN', currency: 'GNF', direction: 'CREDIT', amount: '100' },
          { account: 'USDT_HOT_WALLET', currency: 'USDT', direction: 'DEBIT', amount: '5' },
          { account: 'TREASURY_ADJUSTMENT_USDT', currency: 'USDT', direction: 'CREDIT', amount: '4' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalError);
  });

  it('rejects a single-line journal', async () => {
    const { tx } = fakeTx();
    await expect(
      svc.post(tx, {
        reference: 'r',
        referenceType: 'test',
        referenceId: '4',
        lines: [{ account: 'GNF_PDV_01', currency: 'GNF', direction: 'DEBIT', amount: '1' }],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalError);
  });
});
