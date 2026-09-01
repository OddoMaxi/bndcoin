import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface LockOptions {
  ttlMs?: number;
  retryDelayMs?: number;
  maxWaitMs?: number;
}

/**
 * Minimal single-instance-safe distributed lock (SET NX PX + checked release).
 * The authoritative concurrency guard is always the database row lock; this
 * just keeps duplicate provider calls / queue retries from piling up.
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(key: string, fn: () => Promise<T>, opts: LockOptions = {}): Promise<T> {
    const ttlMs = opts.ttlMs ?? 15_000;
    const retryDelayMs = opts.retryDelayMs ?? 100;
    const maxWaitMs = opts.maxWaitMs ?? 10_000;
    const lockKey = `lock:${key}`;
    const token = randomUUID();

    const deadline = Date.now() + maxWaitMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ok = await this.redis.client.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (ok === 'OK') break;
      if (Date.now() > deadline) {
        throw new Error(`Timed out acquiring lock ${lockKey}`);
      }
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }

    try {
      return await fn();
    } finally {
      try {
        await this.redis.client.eval(RELEASE_SCRIPT, 1, lockKey, token);
      } catch (err) {
        this.logger.warn(`Failed to release lock ${lockKey}: ${(err as Error).message}`);
      }
    }
  }
}
