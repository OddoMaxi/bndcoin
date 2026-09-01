import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SECONDS = 6 * 3600;

/**
 * Redis-backed store for the mock provider "what should happen next" scenarios
 * an admin pushes via the /mock/* endpoints. Nothing here runs unless
 * MOCK_PROVIDERS_ENABLED is on.
 */
@Injectable()
export class MockScenarioService {
  constructor(private readonly redis: RedisService) {}

  private key(kind: 'payment' | 'crypto', txId: string) {
    return `mock:${kind}:scenario:${txId}`;
  }

  async setScenario(kind: 'payment' | 'crypto', txId: string, scenario: string): Promise<void> {
    await this.redis.client.set(this.key(kind, txId), scenario, 'EX', TTL_SECONDS);
  }

  async getScenario(kind: 'payment' | 'crypto', txId: string): Promise<string | null> {
    return this.redis.client.get(this.key(kind, txId));
  }

  async mapRef(providerRef: string, txId: string): Promise<void> {
    await this.redis.client.set(`mock:payment:ref:${providerRef}`, txId, 'EX', TTL_SECONDS);
  }

  async resolveRef(providerRef: string): Promise<string | null> {
    return this.redis.client.get(`mock:payment:ref:${providerRef}`);
  }

  async mapCryptoHash(txHash: string, txId: string): Promise<void> {
    await this.redis.client.set(`mock:crypto:hash:${txHash}`, txId, 'EX', TTL_SECONDS);
  }

  async resolveCryptoHash(txHash: string): Promise<string | null> {
    return this.redis.client.get(`mock:crypto:hash:${txHash}`);
  }

  /** Records the first time a scenario was observed, for DELAYED timing. */
  async markFirstSeen(kind: 'payment' | 'crypto', txId: string): Promise<number> {
    const k = `mock:${kind}:seen:${txId}`;
    const existing = await this.redis.client.get(k);
    if (existing) return Number(existing);
    const now = Date.now();
    await this.redis.client.set(k, String(now), 'EX', TTL_SECONDS);
    return now;
  }
}
