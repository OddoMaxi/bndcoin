import { TransactionStatus } from '@prisma/client';
import {
  BUY_HAPPY_PATH,
  TRANSACTION_TRANSITIONS,
  isTerminalStatus as sharedIsTerminal,
} from '@bn/shared-types';
import { InvalidTransitionError } from '../../../common/errors/domain-errors';

export const HAPPY_PATH = BUY_HAPPY_PATH as readonly TransactionStatus[];

export function allowedTargets(from: TransactionStatus): readonly TransactionStatus[] {
  return (TRANSACTION_TRANSITIONS[from] ?? []) as readonly TransactionStatus[];
}

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return allowedTargets(from).includes(to);
}

export function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminal(status: TransactionStatus): boolean {
  return sharedIsTerminal(status);
}
