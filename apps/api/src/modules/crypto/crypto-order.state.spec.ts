import { InvalidTransitionError } from '../../common/state-machine/state-machine';
import { BUY_TRANSITIONS, SELL_TRANSITIONS, tableFor } from './crypto-order.state';

describe('crypto order state machines', () => {
  it('walks the BUY happy path', () => {
    const path = [
      'CREATED',
      'QUOTE_LOCKED',
      'USDT_RESERVED',
      'AWAITING_PAYMENT',
      'PAYMENT_DETECTED',
      'PAYMENT_RECONCILING',
      'PAYMENT_VERIFIED',
      'USDT_PROCESSING',
      'USDT_SENT',
      'COMPLETED',
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(BUY_TRANSITIONS.can(path[i], path[i + 1])).toBe(true);
    }
  });

  it('walks the SELL happy path', () => {
    const path = [
      'CREATED',
      'QUOTE_LOCKED',
      'AWAITING_CRYPTO',
      'CRYPTO_DETECTED',
      'CONFIRMING',
      'CRYPTO_CONFIRMED',
      'GNF_RESERVED',
      'PAYOUT_PENDING',
      'PAYOUT_PROCESSING',
      'COMPLETED',
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(SELL_TRANSITIONS.can(path[i], path[i + 1])).toBe(true);
    }
  });

  it('never pays GNF before crypto is confirmed (SELL)', () => {
    expect(SELL_TRANSITIONS.can('AWAITING_CRYPTO', 'PAYOUT_PENDING')).toBe(false);
    expect(SELL_TRANSITIONS.can('CRYPTO_DETECTED', 'GNF_RESERVED')).toBe(false);
    expect(SELL_TRANSITIONS.can('CRYPTO_CONFIRMED', 'GNF_RESERVED')).toBe(true);
  });

  it('never sends USDT before payment is verified (BUY)', () => {
    expect(BUY_TRANSITIONS.can('AWAITING_PAYMENT', 'USDT_PROCESSING')).toBe(false);
    expect(BUY_TRANSITIONS.can('PAYMENT_DETECTED', 'USDT_SENT')).toBe(false);
    expect(BUY_TRANSITIONS.can('PAYMENT_VERIFIED', 'USDT_PROCESSING')).toBe(true);
  });

  it('treats terminal states as terminal', () => {
    for (const s of ['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'] as const) {
      expect(BUY_TRANSITIONS.isTerminal(s)).toBe(true);
      expect(BUY_TRANSITIONS.targets(s)).toHaveLength(0);
    }
  });

  it('assert throws on an illegal jump', () => {
    expect(() => tableFor('BUY_USDT').assert('CREATED', 'COMPLETED')).toThrow(InvalidTransitionError);
  });

  it('allows recovery from UNDER_REVIEW on both sides', () => {
    expect(BUY_TRANSITIONS.can('UNDER_REVIEW', 'USDT_PROCESSING')).toBe(true);
    expect(SELL_TRANSITIONS.can('UNDER_REVIEW', 'PAYOUT_PENDING')).toBe(true);
  });
});
