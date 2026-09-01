import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'bn:idempotent';

/**
 * Marks a mutating route as requiring an `Idempotency-Key` header. The
 * IdempotencyInterceptor persists the first response and replays it for repeats
 * of the same key + payload.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
