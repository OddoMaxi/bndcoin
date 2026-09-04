import { Body, Controller, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CanActivate, Injectable } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AppConfigService } from '../../common/config/app-config.service';
import { RequirePermission } from '../../common/rbac/decorators';
import { MockScenarioService } from '../../common/mock/mock-scenario.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class MockEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}
  canActivate(): boolean {
    if (!this.config.mockEnabled) throw new NotFoundException('Cannot POST to this route');
    return true;
  }
}

class OrangePaymentDto {
  @IsIn(['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'DELAYED', 'TIMEOUT', 'AMOUNT_MISMATCH']) scenario!: string;
}
class OrangePayoutDto {
  @IsIn(['PAYOUT_SUCCESS', 'PAYOUT_FAILED', 'DELAYED']) scenario!: string;
}
class CryptoDepositDto {
  @IsIn(['NONE', 'PENDING', 'CONFIRMED', 'AMOUNT_MISMATCH', 'TIMEOUT']) scenario!: string;
}
class CryptoSendDto {
  @IsIn(['CONFIRMED', 'PENDING', 'FAILED']) scenario!: string;
}

@ApiTags('mock')
@UseGuards(MockEnabledGuard)
@RequirePermission('mock.operate')
@Controller('mock')
export class MockControlController {
  constructor(
    private readonly config: AppConfigService,
    private readonly scenarios: MockScenarioService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tickets: TicketsService,
  ) {}

  /** Drive an Orange Money collection for a crypto BUY / event order. */
  @Post('orange/payment/:orderRef/event')
  async payment(@Param('orderRef') orderRef: string, @Body() dto: OrangePaymentDto) {
    // orderRef can be a crypto order id or an event order id
    const cryptoOrder = await this.prisma.cryptoOrder.findUnique({ where: { id: orderRef } });
    if (cryptoOrder?.paymentIntentId) {
      await this.scenarios.setScenario('payment', cryptoOrder.paymentIntentId, dto.scenario);
      const order = await this.crypto.driveBuy(orderRef);
      return this.crypto.getOrderDto(order.id, undefined, true);
    }
    const eventOrder = await this.prisma.eventOrder.findUnique({ where: { id: orderRef } });
    if (eventOrder?.paymentIntentId) {
      await this.scenarios.setScenario('payment', eventOrder.paymentIntentId, dto.scenario);
      const updated = await this.tickets.driveOrder(orderRef);
      return { status: updated.status, publicId: updated.publicId };
    }
    throw new NotFoundException('No payment-bearing order for that id');
  }

  /** Drive an Orange Money payout for a crypto SELL / settlement. */
  @Post('orange/payout/:payoutId/event')
  async payout(@Param('payoutId') payoutId: string, @Body() dto: OrangePayoutDto) {
    await this.scenarios.setScenario('payout', payoutId, dto.scenario);
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (payout?.refType === 'crypto_order') {
      const order = await this.crypto.driveSell(payout.refId);
      return this.crypto.getOrderDto(order.id, undefined, true);
    }
    return { ok: true, scenario: dto.scenario };
  }

  /** Set the on-chain deposit scenario for a SELL order (keyed by its quote publicId). */
  @Post('crypto/deposit/:orderId/event')
  async deposit(@Param('orderId') orderId: string, @Body() dto: CryptoDepositDto) {
    const order = await this.prisma.cryptoOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('order');
    const quote = order.quoteId ? await this.prisma.priceQuote.findUnique({ where: { id: order.quoteId } }) : null;
    await this.scenarios.setScenario('crypto-deposit', quote?.publicId ?? order.id, dto.scenario);
    await this.scenarios.setScenario('crypto-deposit', order.quoteId ?? order.id, dto.scenario);
    const updated = await this.crypto.driveSell(orderId);
    return this.crypto.getOrderDto(updated.id, undefined, true);
  }

  /** Set the on-chain send scenario for a BUY order. */
  @Post('crypto/send/:orderId/event')
  async send(@Param('orderId') orderId: string, @Body() dto: CryptoSendDto) {
    await this.scenarios.setScenario('crypto-send', orderId, dto.scenario);
    const updated = await this.crypto.driveBuy(orderId);
    return this.crypto.getOrderDto(updated.id, undefined, true);
  }
}
