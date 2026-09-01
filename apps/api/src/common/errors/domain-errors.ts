/**
 * Domain errors carry an HTTP status and a stable machine code. The global
 * exception filter turns them into the shared ApiErrorDto shape.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', id ? `${entity} ${id} not found` : `${entity} not found`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class GoneError extends DomainError {
  constructor(message: string) {
    super('GONE', message, 410);
  }
}

// --- specific domain conditions ---

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_TRANSITION', `Transaction cannot move from ${from} to ${to}`, 409, { from, to });
  }
}

export class InsufficientLiquidityError extends DomainError {
  constructor(asset: string, requested: string, available: string) {
    super(
      'INSUFFICIENT_LIQUIDITY',
      `Not enough ${asset} liquidity: requested ${requested}, available ${available}`,
      409,
      { asset, requested, available },
    );
  }
}

export class QuoteExpiredError extends GoneError {
  constructor() {
    super('Quote has expired; request a new one');
  }
}

export class IdempotencyConflictError extends ConflictError {
  constructor() {
    super('IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress');
  }
}

export class IdempotencyKeyMismatchError extends ConflictError {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different request payload',
    );
  }
}
