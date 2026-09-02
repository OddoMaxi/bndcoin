import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { SettlementsService } from './settlements.service';

@ApiTags('settlements')
@RequirePermission('settlements.read')
@Controller('admin/settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.settlements.list(status);
  }

  @RequirePermission('settlements.approve')
  @Post(':id/approve')
  approve(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.settlements.approve(actorId, id);
  }

  @RequirePermission('settlements.approve')
  @Post(':id/pay')
  pay(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.settlements.pay(actorId, id);
  }
}
