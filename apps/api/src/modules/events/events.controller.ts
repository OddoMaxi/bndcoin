import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { CurrentUser, Public, RequirePermission } from '../../common/rbac/decorators';
import { EventsService } from './events.service';

class StatusDto {
  @IsIn(['PUBLISHED', 'PENDING_APPROVAL', 'CANCELLED', 'COMPLETED', 'DRAFT']) status!: string;
  @IsString() reason?: string;
}

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get('events')
  list(@Query('category') category?: string, @Query('city') city?: string, @Query('featured') featured?: string) {
    return this.events.listPublished({ category, city, featured: featured === 'true' });
  }

  @Public()
  @Get('events/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.events.getBySlug(slug);
  }

  // organizer
  @Get('organizer/events')
  myEvents(@CurrentUser('id') userId: string) {
    return this.events.myEvents(userId);
  }

  @Post('organizer/events')
  create(@CurrentUser('id') userId: string, @Body() dto: Record<string, unknown>) {
    return this.events.createEvent(userId, dto);
  }

  @Patch('organizer/events/:id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.events.updateEvent(userId, id, dto);
  }

  @Post('organizer/events/:id/ticket-types')
  addTicketType(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.events.addTicketType(userId, id, dto);
  }

  @Post('organizer/events/:id/submit')
  submit(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.events.submitForApproval(userId, id);
  }

  // admin
  @RequirePermission('events.read')
  @Get('admin/events')
  adminList(@Query('status') status?: string) {
    return this.events.adminList(status);
  }

  @RequirePermission('events.approve')
  @Post('admin/events/:id/status')
  setStatus(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.events.setStatus(actorId, id, dto.status as never, dto.reason);
  }

  @RequirePermission('events.approve')
  @Post('admin/events/:id/feature')
  feature(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body('featured') featured: boolean) {
    return this.events.setFeatured(actorId, id, featured);
  }
}
