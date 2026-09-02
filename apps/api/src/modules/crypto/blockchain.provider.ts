import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { MockScenarioService } from '../../common/mock/mock-scenario.service';

export const BLOCKCHAIN_PROVIDER = Symbol('BLOCKCHAIN_PROVIDER');

export interface ChainTx {
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  confirmations: number;
}
export interface IncomingDeposit {
  txHash: string;
  amount: string;
  confirmations: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

export interface BlockchainProvider {
  readonly key: string;
  validateAddress(networkKey: string, address: string, regex?: string): boolean;
  deriveDepositAddress(networkKey: string, ref: string): Promise<{ address: string; derivationRef: string }>;
  /** Poll for a deposit at `address` expecting ~`expectedAmount`. */
  getIncoming(networkKey: string, address: string, expectedAmount: string, ref: string): Promise<IncomingDeposit | null>;
  sendUsdt(networkKey: string, toAddress: string, amount: string, idempotencyKey: string): Promise<{ txHash: string; broadcast: boolean }>;
  getTransaction(networkKey: string, txHash: string): Promise<ChainTx>;
}

const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;

@Injectable()
export class MockBlockchainProvider implements BlockchainProvider {
  readonly key = 'mock';
  private readonly logger = new Logger(MockBlockchainProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly scenarios: MockScenarioService,
  ) {}

  validateAddress(_networkKey: string, address: string, regex?: string): boolean {
    if (regex) {
      try {
        return new RegExp(regex).test(address);
      } catch {
        /* fall through */
      }
    }
    return TRON.test(address) || EVM.test(address);
  }

  async deriveDepositAddress(networkKey: string, ref: string) {
    const seed = createHash('sha256').update(`${networkKey}:${ref}`).digest('hex');
    const address = networkKey.toUpperCase().includes('TRON')
      ? `T${base58(seed).slice(0, 33)}`
      : `0x${seed.slice(0, 40)}`;
    await this.scenarios.mapCryptoHash(`addr:${address}`, ref);
    return { address, derivationRef: `mock/${seed.slice(0, 12)}` };
  }

  async getIncoming(_networkKey: string, address: string, expectedAmount: string, ref: string) {
    const scenario = await this.scenarios.getScenario('crypto-deposit', ref);
    if (!scenario || scenario === 'NONE' || scenario === 'TIMEOUT') return null;
    const txHash = createHash('sha256').update(`dep:${address}:${ref}`).digest('hex');
    await this.scenarios.mapCryptoHash(txHash, ref);
    const required = this.config.flow.requiredConfirmations;
    const amount = scenario === 'AMOUNT_MISMATCH' ? '1' : expectedAmount;
    if (scenario === 'PENDING') return { txHash, amount, confirmations: 1, status: 'PENDING' as const };
    return { txHash, amount, confirmations: required, status: 'CONFIRMED' as const };
  }

  async sendUsdt(_networkKey: string, toAddress: string, amount: string, idempotencyKey: string) {
    const scenario = await this.scenarios.getScenario('crypto-send', idempotencyKey.split(':')[0]);
    if (scenario === 'FAILED') return { txHash: '', broadcast: false };
    const txHash = createHash('sha256').update(`send:${idempotencyKey}`).digest('hex');
    await this.scenarios.mapCryptoHash(txHash, idempotencyKey.split(':')[0]);
    this.logger.log(`[mock-chain] send ${amount} USDT -> ${toAddress} hash=${txHash}`);
    return { txHash, broadcast: true };
  }

  async getTransaction(_networkKey: string, txHash: string): Promise<ChainTx> {
    const ref = await this.scenarios.resolveCryptoHash(txHash);
    const scenario = ref ? await this.scenarios.getScenario('crypto-send', ref) : null;
    const required = this.config.flow.requiredConfirmations;
    if (scenario === 'FAILED') return { txHash, status: 'FAILED', confirmations: 0 };
    if (scenario === 'PENDING') return { txHash, status: 'PENDING', confirmations: 1 };
    return { txHash, status: 'CONFIRMED', confirmations: required };
  }
}

@Injectable()
export class LiveBlockchainProvider implements BlockchainProvider {
  readonly key = 'live';
  validateAddress(): boolean {
    return false;
  }
  private fail(): never {
    throw new Error('LiveBlockchainProvider is not configured. Set BLOCKCHAIN_PROVIDER=live with RPC + wallet config.');
  }
  deriveDepositAddress(): Promise<{ address: string; derivationRef: string }> {
    return this.fail();
  }
  getIncoming(): Promise<IncomingDeposit | null> {
    return this.fail();
  }
  sendUsdt(): Promise<{ txHash: string; broadcast: boolean }> {
    return this.fail();
  }
  getTransaction(): Promise<ChainTx> {
    return this.fail();
  }
}

function base58(hex: string): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    out += alphabet[parseInt(hex.slice(i, i + 2), 16) % 58];
  }
  return (out + out).slice(0, 40);
}
