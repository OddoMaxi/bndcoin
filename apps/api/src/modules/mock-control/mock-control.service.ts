import { Injectable, Logger } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { MockScenarioService } from '../../common/mock/mock-scenario.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BuyFlowService } from '../transactions/buy-flow.service';
import { TransactionsService } from '../transactions/transactions.service';
import { MockCryptoEventDto, MockPaymentEventDto } from './dto';

@Injectable()
export class MockControlService {
  private readonly logger = new Logger(MockControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scenarios: MockScenarioService,
    private readonly buyFlow: BuyFlowService,
    private readonly transactions: TransactionsService,
  ) {}

  private async loadTx(id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundError('Transaction', id);
    return tx;
  }

  async paymentEvent(transactionId: string, dto: MockPaymentEventDto) {
    const tx = await this.loadTx(transactionId);
    await this.scenarios.setScenario('payment', transactionId, dto.scenario);
    await this.prisma.mockEvent.create({
      data: {
        providerType: 'PAYMENT',
        providerKey: tx.paymentProviderKey,
        transactionId,
        scenario: dto.scenario,
        processedAt: new Date(),
      },
    });
    this.logger.log(`[mock] payment scenario ${dto.scenario} for ${tx.publicId}`);

    switch (dto.scenario) {
      case 'PAYMENT_SUCCESS':
        await this.buyFlow.drive(transactionId);
        break;
      case 'PAYMENT_FAILED':
      case 'INSUFFICIENT_BALANCE':
        await this.buyFlow.pollPayment(transactionId);
        break;
      case 'DELAYED':
        await this.buyFlow.pollPayment(transactionId); // -> PAYMENT_DETECTED
        break;
      case 'TIMEOUT':
        await this.buyFlow.expirePayment(transactionId, { force: true });
        break;
    }
    return this.transactions.getDto(transactionId, undefined, true);
  }

  async cryptoEvent(transactionId: string, dto: MockCryptoEventDto) {
    const tx = await this.loadTx(transactionId);
    await this.scenarios.setScenario('crypto', transactionId, dto.scenario);
    await this.prisma.mockEvent.create({
      data: {
        providerType: 'CRYPTO',
        providerKey: tx.cryptoProviderKey,
        transactionId,
        scenario: dto.scenario,
        processedAt: new Date(),
      },
    });
    this.logger.log(`[mock] crypto scenario ${dto.scenario} for ${tx.publicId}`);

    if (tx.status === 'PAYMENT_CONFIRMED') {
      await this.buyFlow.processUsdt(transactionId);
    }
    if (['USDT_PROCESSING', 'USDT_SENT'].includes((await this.loadTx(transactionId)).status)) {
      await this.buyFlow.confirmUsdt(transactionId);
    }
    return this.transactions.getDto(transactionId, undefined, true);
  }

  async setScenarios(transactionId: string, payment?: string, crypto?: string) {
    await this.loadTx(transactionId);
    if (!payment && !crypto) {
      throw new ValidationError('Provide paymentScenario and/or cryptoScenario');
    }
    if (payment) await this.scenarios.setScenario('payment', transactionId, payment);
    if (crypto) await this.scenarios.setScenario('crypto', transactionId, crypto);
    return { transactionId, payment: payment ?? null, crypto: crypto ?? null };
  }
}
