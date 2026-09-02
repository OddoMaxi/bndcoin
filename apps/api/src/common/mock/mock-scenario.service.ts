import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 12 * 3600;

/** Redis-backed store for the "what happens next" scenarios an admin pushes via /mock/*. */
@Injectable()
export class MockScenarioService {
  constructor(private readonly redis: RedisService) {}

  async setScenario(kind: string, refId: string, scenario: string): Promise<void> {
    await this.redis.client.set(`mock:${kind}:scenario:${refId}`, scenario, 'EX', TTL_SECONDS);
  }

  async getScenario(kind: string, refId: string): Promise<string | null> {
    return this.redis.client.get(`mock:${kind}:scenario:${refId}`);
  }

  async mapRef(externalRef: string, refId: string): Promise<void> {
    await this.redis.client.set(`mock:ref:${externalRef}`, refId, 'EX', TTL_SECONDS);
  }

  async resolveRef(externalRef: string): Promise<string | null> {
    return this.redis.client.get(`mock:ref:${externalRef}`);
  }

  async mapCryptoHash(txHash: string, refId: string): Promise<void> {
    await this.redis.client.set(`mock:crypto:hash:${txHash}`, refId, 'EX', TTL_SECONDS);
  }

  async resolveCryptoHash(txHash: string): Promise<string | null> {
    return this.redis.client.get(`mock:crypto:hash:${txHash}`);
  }

  async markFirstSeen(kind: string, refId: string): Promise<number> {
    const k = `mock:${kind}:seen:${refId}`;
    const existing = await this.redis.client.get(k);
    if (existing) return Number(existing);
    const now = Date.now();
    await this.redis.client.set(k, String(now), 'EX', TTL_SECONDS);
    return now;
  }
}
