import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../../common/config/app-config.service';
import { MockScenarioService } from '../../../common/mock/mock-scenario.service';
import {
  CryptoProvider,
  CryptoTransactionResult,
  SendUsdtRequest,
  SendUsdtResult,
} from '../crypto-provider.interface';

const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Simulates an on-chain USDT sender.
 *
 * Scenarios (set per transaction via POST /mock/crypto/:id/event):
 *   - (none) / CONFIRMED : instantly confirmed with the required confirmations
 *   - SENT               : broadcast, stays PENDING at 1 confirmation
 *   - FAILED             : sendUSDT / getTransaction report FAILED
 */
@Injectable()
export class MockCryptoProvider implements CryptoProvider {
  readonly key = 'mock';
  private readonly logger = new Logger(MockCryptoProvider.name);

  constructor(
    private readonly scenarios: MockScenarioService,
    private readonly config: AppConfigService,
  ) {}

  validateAddress(address: string): boolean {
    return TRON_ADDRESS.test(address) || EVM_ADDRESS.test(address);
  }

  async sendUSDT(req: SendUsdtRequest): Promise<SendUsdtResult> {
    const scenario = await this.scenarios.getScenario('crypto', req.transactionId);
    if (scenario === 'FAILED') {
      this.logger.warn(`[mock-crypto] send FAILED for tx=${req.transactionId}`);
      return { txHash: '', status: 'FAILED', raw: { scenario } };
    }
    const txHash = createHash('sha256')
      .update(`${req.transactionId}:${req.idempotencyKey}`)
      .digest('hex');
    await this.scenarios.mapCryptoHash(txHash, req.transactionId);
    this.logger.log(`[mock-crypto] broadcast ${req.amount} USDT -> ${req.toAddress} hash=${txHash}`);
    return { txHash, status: 'BROADCAST', raw: { scenario: scenario ?? 'default' } };
  }

  async getTransaction(txHash: string): Promise<CryptoTransactionResult> {
    const txId = await this.scenarios.resolveCryptoHash(txHash);
    const scenario = txId ? await this.scenarios.getScenario('crypto', txId) : null;
    const required = this.config.flow.requiredConfirmations;

    if (scenario === 'FAILED') {
      return { txHash, status: 'FAILED', confirmations: 0 };
    }
    if (scenario === 'SENT') {
      return { txHash, status: 'PENDING', confirmations: 1 };
    }
    return { txHash, status: 'CONFIRMED', confirmations: required };
  }

  async getBalance(): Promise<{ asset: 'USDT'; available: string }> {
    return { asset: 'USDT', available: '1000000' };
  }
}
