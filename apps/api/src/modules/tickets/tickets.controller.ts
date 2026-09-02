import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, RequirePermission } from '../../common/rbac/decorators';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { TicketsService } from './tickets.service';

class ItemDto {
  @IsString() ticketTypeId!: string;
  @IsInt() @Min(1) @Max(50) quantity!: number;
}
class CreateOrderDto {
  @IsString() eventId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
  @IsIn(['GNF', 'USDT']) currency!: 'GNF' | 'USDT';
}
class ScanDto {
  @IsString() eventId!: string;
  @IsString() gate!: string;
  @IsString() qrToken!: string;
}

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('event-orders')
  @Idempotent()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    const { order, paymentIntentId } = await this.tickets.createOrder(userId, dto.eventId, dto.items, dto.currency);
    if (paymentIntentId) await this.tickets.startPayment(order.id);
    return { orderId: order.id, publicId: order.publicId, status: order.status, currency: order.currency };
  }

  @Get('event-orders')
  myOrders(@CurrentUser('id') userId: string) {
    return this.tickets.myOrders(userId);
  }

  @Get('event-orders/:id')
  order(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tickets.driveOrder(id).then((o) => ({ status: o.status, publicId: o.publicId }));
  }

  @Get('tickets')
  myTickets(@CurrentUser('id') userId: string) {
    return this.tickets.myTickets(userId);
  }

  @Get('tickets/:id')
  ticket(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tickets.ticketDetail(userId, id);
  }

  // ---- scanner ----
  @RequirePermission('checkin.scan')
  @Get('scanner/events')
  scannerEvents(@CurrentUser('id') userId: string) {
    return this.tickets.scannerEvents(userId);
  }

  @RequirePermission('checkin.scan')
  @Get('scanner/events/:id/stats')
  stats(@Param('id') id: string) {
    return this.tickets.eventCheckinStats(id);
  }

  @RequirePermission('checkin.scan')
  @Post('scanner/scan')
  scan(@CurrentUser('id') userId: string, @Body() dto: ScanDto) {
    return this.tickets.checkIn(userId, dto.eventId, dto.gate, dto.qrToken);
  }

  // ---- admin ----
  @RequirePermission('tickets.read')
  @Get('admin/tickets')
  adminTickets(@Query('eventId') eventId?: string) {
    return this.tickets.adminTickets(eventId);
  }
}
