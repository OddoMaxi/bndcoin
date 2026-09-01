import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/rbac/decorators';
import { MockCryptoEventDto, MockPaymentEventDto, MockScenariosDto } from './dto';
import { MockControlService } from './mock-control.service';
import { MockEnabledGuard } from './mock.guard';

@ApiTags('mock')
@UseGuards(MockEnabledGuard)
@Roles('ADMIN')
@Controller('mock')
export class MockControlController {
  constructor(private readonly mock: MockControlService) {}

  @Post('payment/:transactionId/event')
  payment(@Param('transactionId') id: string, @Body() dto: MockPaymentEventDto) {
    return this.mock.paymentEvent(id, dto);
  }

  @Post('crypto/:transactionId/event')
  crypto(@Param('transactionId') id: string, @Body() dto: MockCryptoEventDto) {
    return this.mock.cryptoEvent(id, dto);
  }

  @Post('scenarios')
  scenarios(@Body() dto: MockScenariosDto) {
    return this.mock.setScenarios(dto.transactionId, dto.paymentScenario, dto.cryptoScenario);
  }
}
