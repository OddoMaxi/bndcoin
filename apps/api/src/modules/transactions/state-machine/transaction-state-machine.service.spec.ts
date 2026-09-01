import { InvalidTransitionError } from '../../../common/errors/domain-errors';
import { TransactionStateMachine } from './transaction-state-machine.service';

function makeHarness(currentStatus: string, existingEvent: unknown = null) {
  const tx = {
    transactionEvent: {
      findUnique: jest.fn().mockResolvedValue(existingEvent),
      create: jest.fn().mockResolvedValue({}),
    },
    transaction: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 't1', publicId: 'BN-TEST', status: currentStatus }),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: 't1',
        publicId: 'BN-TEST',
        status: data.status ?? currentStatus,
      })),
    },
  };
  const prisma = {
    runInTransaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    lockTransaction: jest.fn().mockResolvedValue({ id: 't1', status: currentStatus }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const sm = new TransactionStateMachine(prisma as never, audit as never);
  return { sm, tx, prisma, audit };
}

describe('TransactionStateMachine.apply', () => {
  it('applies a legal transition and writes an event + audit row', async () => {
    const { sm, tx, audit } = makeHarness('QUOTE_LOCKED');
    const result = await sm.apply('t1', { event: 'await-payment', toStatus: 'WAITING_PAYMENT' });

    expect(result.status).toBe('WAITING_PAYMENT');
    expect(tx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING_PAYMENT' }) }),
    );
    expect(tx.transactionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previousStatus: 'QUOTE_LOCKED', nextStatus: 'WAITING_PAYMENT' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects an illegal transition without mutating', async () => {
    const { sm, tx } = makeHarness('CREATED');
    await expect(
      sm.apply('t1', { event: 'jump', toStatus: 'USDT_SENT' }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('is an idempotent no-op when the same event was already recorded', async () => {
    const { sm, tx } = makeHarness('WAITING_PAYMENT', { id: 'evt1' });
    const result = await sm.apply('t1', { event: 'await-payment', toStatus: 'WAITING_PAYMENT' });
    expect(result.status).toBe('WAITING_PAYMENT');
    expect(tx.transaction.update).not.toHaveBeenCalled();
    expect(tx.transactionEvent.create).not.toHaveBeenCalled();
  });

  it('runs the mutate hook and merges its extra columns', async () => {
    const { sm, tx } = makeHarness('PAYMENT_CONFIRMED');
    const mutate = jest.fn().mockResolvedValue({ cryptoTxHash: '0xdead' });
    await sm.apply('t1', { event: 'usdt-processing', toStatus: 'USDT_PROCESSING', mutate });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(tx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'USDT_PROCESSING', cryptoTxHash: '0xdead' }),
      }),
    );
  });
});
