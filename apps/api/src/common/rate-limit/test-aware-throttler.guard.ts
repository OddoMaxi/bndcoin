import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Same throttling as production, except entirely skipped when NODE_ENV=test.
 * The e2e suite runs many requests from the same loopback IP within a single
 * jest run; without this, tight per-route limits (e.g. OTP request) meant for
 * abuse prevention start rejecting legitimate test traffic as the suite grows.
 */
@Injectable()
export class TestAwareThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return process.env.NODE_ENV === 'test';
  }
}
