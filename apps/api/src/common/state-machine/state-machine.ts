import { DomainError } from '../errors/domain-errors';

export class InvalidTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super('INVALID_TRANSITION', `${entity} cannot move from ${from} to ${to}`, 409, { from, to });
  }
}

/**
 * Generic transition-table validator. Each domain provides its own table; the
 * table is the authority and is enforced server-side.
 */
export class TransitionTable<S extends string> {
  constructor(
    private readonly entity: string,
    private readonly table: Record<S, readonly S[]>,
    private readonly terminal: readonly S[],
  ) {}

  can(from: S, to: S): boolean {
    return this.table[from]?.includes(to) ?? false;
  }

  assert(from: S, to: S): void {
    if (!this.can(from, to)) throw new InvalidTransitionError(this.entity, from, to);
  }

  isTerminal(s: S): boolean {
    return this.terminal.includes(s);
  }

  targets(from: S): readonly S[] {
    return this.table[from] ?? [];
  }
}
