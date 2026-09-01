import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { MockScenarioService } from '../../../common/mock/mock-scenario.service';
import {
  CheckTransactionResult,
  CollectRequest,
  CollectResult,
  PaymentProvider,
  PayoutRequest,
  PayoutResult,
} from '../payment-provider.interface';

/** How long a DELAYED payment takes to "settle" after first being polled. */
const DELAYED_SETTLE_MS = 5_000;

/**
 * Simulates the Orange Money collect / payout rail.
 *
 * Scenarios (set per transaction via POST /mock/payment/:id/event):
 *   - (none) / TIMEOUT      : stays PENDING forever
 *   - PAYMENT_SUCCESS       : settles on the next check
 *   - PAYMENT_FAILED        : check reports FAILED
 *   - INSUFFICIENT_BALANCE  : check reports INSUFFICIENT_BALANCE
 *   - DELAYED               : PENDING, then SETTLED ~5s after the first check
 */
@Injectable()
export class MockOrangeMoneyProvider implements PaymentProvider {
  readonly key = 'mock';
  private readonly logger = new Logger(MockOrangeMoneyProvider.name);

  constructor(private readonly scenarios: MockScenarioService) {}

  async collect(req: CollectRequest): Promise<CollectResult> {
    const providerRef = `OM-MOCK-${req.transactionId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    await this.scenarios.mapRef(providerRef, req.transactionId);
    this.logger.log(
      `[mock-om] collect ${req.amount} ${req.currency} for tx=${req.transactionId} ref=${providerRef}`,
    );
    return { providerRef, status: 'PENDING', raw: { simulated: true } };
  }

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    const providerRef = `OM-MOCK-PO-${req.transactionId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    this.logger.log(`[mock-om] payout ${req.amount} ${req.currency} -> ${req.toPhone}`);
    return { providerRef, status: 'PENDING', raw: { simulated: true } };
  }

  async checkTransaction(providerRef: string): Promise<CheckTransactionResult> {
    const txId = await this.scenarios.resolveRef(providerRef);
    const scenario = txId ? await this.scenarios.getScenario('payment', txId) : null;

    switch (scenario) {
      case 'PAYMENT_SUCCESS':
        return { providerRef, status: 'SETTLED' };
      case 'PAYMENT_FAILED':
        return { providerRef, status: 'FAILED' };
      case 'INSUFFICIENT_BALANCE':
        return { providerRef, status: 'INSUFFICIENT_BALANCE' };
      case 'DELAYED': {
        const firstSeen = txId ? await this.scenarios.markFirstSeen('payment', txId) : Date.now();
        const settled = Date.now() - firstSeen >= DELAYED_SETTLE_MS;
        return { providerRef, status: settled ? 'SETTLED' : 'DETECTED' };
      }
      case 'TIMEOUT':
      default:
        return { providerRef, status: 'PENDING' };
    }
  }

  async getBalance(): Promise<{ currency: 'GNF'; available: string }> {
    return { currency: 'GNF', available: '999999999999' };
  }
}
