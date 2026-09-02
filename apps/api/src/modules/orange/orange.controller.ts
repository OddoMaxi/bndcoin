import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { ModemManager } from './modem-manager.service';
import { OrangeService } from './orange.service';

class ModemActionDto {
  @IsIn(['ENABLE', 'DISABLE', 'MAINTENANCE']) action!: 'ENABLE' | 'DISABLE' | 'MAINTENANCE';
}

@ApiTags('orange')
@RequirePermission('orange.read')
@Controller('admin/orange')
export class OrangeController {
  constructor(
    private readonly orange: OrangeService,
    private readonly modems: ModemManager,
  ) {}

  @Get('control-centre')
  controlCentre() {
    return this.orange.controlCentre();
  }

  @Get('sessions')
  sessions(@Query('modemId') modemId?: string) {
    return this.orange.listSessions(modemId);
  }

  @RequirePermission('orange.operate')
  @Post('modems/:id/action')
  modemAction(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: ModemActionDto,
  ) {
    return this.modems.setModemState(actorId, id, dto.action);
  }

  @RequirePermission('orange.operate')
  @Post('healthcheck')
  async healthcheck() {
    await this.modems.healthcheckAll();
    return { ok: true };
  }
}
