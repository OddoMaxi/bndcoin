import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { MockScenarioService } from '../../common/mock/mock-scenario.service';
import {
  OrangeCollectRequest,
  OrangeCollectResult,
  OrangeMoneyProvider,
  OrangePayoutRequest,
  OrangePayoutResult,
  OrangeStatusResult,
} from './orange-provider.interface';

const DELAY_MS = 4_000;

/**
 * Simulates the Orange Money collect/payout rails over PDV modems. Scenarios are
 * set per intent/payout id via /mock/orange/*.
 *
 * Payment scenarios:  PAYMENT_SUCCESS | PAYMENT_FAILED | DELAYED | TIMEOUT | AMOUNT_MISMATCH
 * Payout scenarios:   PAYOUT_SUCCESS | PAYOUT_FAILED | DELAYED
 */
@Injectable()
export class MockOrangeMoneyProvider implements OrangeMoneyProvider {
  readonly key = 'mock';
  private readonly logger = new Logger(MockOrangeMoneyProvider.name);

  constructor(private readonly scenarios: MockScenarioService) {}

  async initiateCollect(req: OrangeCollectRequest): Promise<OrangeCollectResult> {
    const ref = `OM-C-${req.intentId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    await this.scenarios.mapRef(ref, req.intentId);
    this.logger.log(`[mock-om] collect ${req.amount} GNF via modem ${req.modemId} ref=${ref}`);
    return { externalReference: ref, accepted: true };
  }

  async initiatePayout(req: OrangePayoutRequest): Promise<OrangePayoutResult> {
    const ref = `OM-P-${req.payoutId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    await this.scenarios.mapRef(ref, req.payoutId);
    const scenario = await this.scenarios.getScenario('payout', req.payoutId);
    this.logger.log(`[mock-om] payout ${req.amount} GNF -> ${req.toPhone} ref=${ref} scenario=${scenario}`);
    if (scenario === 'PAYOUT_FAILED') return { externalReference: ref, status: 'FAILED' };
    return { externalReference: ref, status: 'PROCESSING' };
  }

  async checkStatus(externalReference: string): Promise<OrangeStatusResult> {
    const id = await this.scenarios.resolveRef(externalReference);
    if (!id) return { status: 'PENDING' };
    const payKind = externalReference.startsWith('OM-P-') ? 'payout' : 'payment';
    const scenario = await this.scenarios.getScenario(payKind as 'payment' | 'payout', id);

    if (payKind === 'payout') {
      if (scenario === 'PAYOUT_FAILED') return { status: 'FAILED' };
      if (scenario === 'DELAYED') {
        const first = await this.scenarios.markFirstSeen('payout', id);
        return { status: Date.now() - first >= DELAY_MS ? 'SETTLED' : 'PENDING' };
      }
      return { status: 'SETTLED' }; // PAYOUT_SUCCESS / default
    }

    switch (scenario) {
      case 'PAYMENT_SUCCESS':
        return { status: 'SETTLED', reference: externalReference };
      case 'AMOUNT_MISMATCH':
        return { status: 'SETTLED', amount: '1', reference: externalReference }; // wrong amount
      case 'PAYMENT_FAILED':
        return { status: 'FAILED' };
      case 'DELAYED': {
        const first = await this.scenarios.markFirstSeen('payment', id);
        return { status: Date.now() - first >= DELAY_MS ? 'SETTLED' : 'PENDING' };
      }
      case 'TIMEOUT':
      default:
        return { status: 'PENDING' };
    }
  }

  async modemHealth(): Promise<{ online: boolean; balanceGnf?: string }> {
    return { online: true, balanceGnf: '50000000' };
  }
}

@Injectable()
export class ModemOrangeMoneyProvider implements OrangeMoneyProvider {
  readonly key = 'modem';
  private fail(): never {
    throw new Error(
      'ModemOrangeMoneyProvider is not configured. Connect GSM modems and set ORANGE_MODE=modem with serial config.',
    );
  }
  async initiateCollect(): Promise<OrangeCollectResult> {
    this.fail();
  }
  async initiatePayout(): Promise<OrangePayoutResult> {
    this.fail();
  }
  async checkStatus(): Promise<OrangeStatusResult> {
    this.fail();
  }
  async modemHealth(): Promise<{ online: boolean }> {
    return { online: false };
  }
}
