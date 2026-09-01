import { TransactionStatus } from '@prisma/client';
import { InvalidTransitionError } from '../../../common/errors/domain-errors';
import { allowedTargets, assertTransition, canTransition, isTerminal, HAPPY_PATH } from './transitions';

describe('transaction transitions', () => {
  it('allows every step of the BUY happy path in order', () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i++) {
      expect(canTransition(HAPPY_PATH[i], HAPPY_PATH[i + 1])).toBe(true);
    }
  });

  it('permits QUOTE_LOCKED and later states to reach MANUAL_REVIEW (except QUOTE_LOCKED which cannot skip)', () => {
    expect(canTransition('WAITING_PAYMENT', 'MANUAL_REVIEW')).toBe(true);
    expect(canTransition('PAYMENT_DETECTED', 'MANUAL_REVIEW')).toBe(true);
    expect(canTransition('USDT_SENT', 'MANUAL_REVIEW')).toBe(true);
  });

  it('treats COMPLETED / FAILED / EXPIRED / CANCELLED as terminal', () => {
    for (const s of ['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'] as TransactionStatus[]) {
      expect(isTerminal(s)).toBe(true);
      expect(allowedTargets(s)).toHaveLength(0);
    }
    expect(isTerminal('MANUAL_REVIEW')).toBe(false);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(canTransition('WAITING_PAYMENT', 'USDT_SENT')).toBe(false);
    expect(canTransition('PAYMENT_CONFIRMED', 'WAITING_PAYMENT')).toBe(false);
    expect(() => assertTransition('CREATED', 'USDT_SENT')).toThrow(InvalidTransitionError);
  });

  it('lets MANUAL_REVIEW be resolved forward or terminally', () => {
    for (const t of ['USDT_PROCESSING', 'PAYMENT_CONFIRMED', 'COMPLETED', 'FAILED', 'CANCELLED'] as TransactionStatus[]) {
      expect(canTransition('MANUAL_REVIEW', t)).toBe(true);
    }
  });
});
