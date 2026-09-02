import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { toMoneyString } from '../../common/util/decimal';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6);
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublished(filter: { category?: string; city?: string; featured?: boolean }) {
    const events = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        ...(filter.category ? { category: filter.category as never } : {}),
        ...(filter.city ? { city: { contains: filter.city, mode: 'insensitive' } } : {}),
        ...(filter.featured ? { featured: true } : {}),
      },
      orderBy: [{ featured: 'desc' }, { eventDate: 'asc' }],
      include: { ticketTypes: { where: { status: 'ACTIVE' } }, organizer: { select: { name: true } } },
      take: 100,
    });
    return events.map((e) => this.toCard(e));
  }

  async getBySlug(slug: string) {
    const e = await this.prisma.event.findUnique({
      where: { slug },
      include: { ticketTypes: true, organizer: { select: { name: true } } },
    });
    if (!e || e.status !== 'PUBLISHED') throw new NotFoundError('Event', slug);
    return this.toDetail(e);
  }

  private toCard(e: any) {
    const minPrice = e.ticketTypes.length
      ? e.ticketTypes.reduce((m: any, t: any) => (Number(t.priceGnf) < Number(m.priceGnf) ? t : m)).priceGnf
      : null;
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      category: e.category,
      coverImage: e.coverImage,
      city: e.city,
      venue: e.venue,
      eventDate: e.eventDate.toISOString(),
      featured: e.featured,
      organizerName: e.organizer?.name,
      fromPriceGnf: minPrice ? toMoneyString(minPrice, 'GNF') : null,
    };
  }

  private toDetail(e: any) {
    return {
      ...this.toCard(e),
      description: e.description,
      address: e.address,
      startTime: e.startTime,
      endTime: e.endTime,
      salesEnd: e.salesEnd?.toISOString() ?? null,
      ticketTypes: e.ticketTypes
        .filter((t: any) => t.status === 'ACTIVE')
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priceGnf: toMoneyString(t.priceGnf, 'GNF'),
          priceUsdt: t.priceUsdt ? toMoneyString(t.priceUsdt, 'USDT') : null,
          available: Math.max(0, t.quantity - t.quantitySold),
          maxPerOrder: t.maxPerOrder,
        })),
    };
  }

  // ---- organizer ----
  private async organizerOf(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org || org.status !== 'APPROVED') throw new ForbiddenError('Approved organizer profile required');
    return org;
  }

  async createEvent(userId: string, dto: Record<string, unknown>) {
    const org = await this.organizerOf(userId);
    const event = await this.prisma.event.create({
      data: {
        organizerId: org.id,
        title: dto.title as string,
        slug: slugify(dto.title as string),
        description: dto.description as string,
        category: (dto.category as never) ?? 'OTHER',
        coverImage: dto.coverImage as string,
        venue: dto.venue as string,
        address: dto.address as string,
        city: dto.city as string,
        eventDate: new Date(dto.eventDate as string),
        startTime: dto.startTime as string,
        endTime: dto.endTime as string,
        salesStart: dto.salesStart ? new Date(dto.salesStart as string) : null,
        salesEnd: dto.salesEnd ? new Date(dto.salesEnd as string) : null,
        status: 'DRAFT',
      },
    });
    await this.audit.recordStandalone({ action: 'event.created', entityType: 'Event', entityId: event.id, actorId: userId, after: { title: event.title } });
    return event;
  }

  async updateEvent(userId: string, id: string, dto: Record<string, unknown>) {
    const org = await this.organizerOf(userId);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event || event.organizerId !== org.id) throw new NotFoundError('Event', id);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(event.status)) {
      throw new ValidationError('Only draft events can be edited');
    }
    const data: Record<string, unknown> = {};
    for (const k of ['title', 'description', 'category', 'coverImage', 'venue', 'address', 'city', 'startTime', 'endTime']) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.eventDate) data.eventDate = new Date(dto.eventDate as string);
    if (dto.salesEnd) data.salesEnd = new Date(dto.salesEnd as string);
    return this.prisma.event.update({ where: { id }, data });
  }

  async addTicketType(userId: string, eventId: string, dto: Record<string, unknown>) {
    const org = await this.organizerOf(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.organizerId !== org.id) throw new NotFoundError('Event', eventId);
    return this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name as string,
        description: dto.description as string,
        priceGnf: dto.priceGnf as string,
        priceUsdt: (dto.priceUsdt as string) ?? null,
        quantity: dto.quantity as number,
        maxPerOrder: (dto.maxPerOrder as number) ?? 10,
      },
    });
  }

  async submitForApproval(userId: string, id: string) {
    const org = await this.organizerOf(userId);
    const event = await this.prisma.event.findUnique({ where: { id }, include: { ticketTypes: true } });
    if (!event || event.organizerId !== org.id) throw new NotFoundError('Event', id);
    if (event.ticketTypes.length === 0) throw new ValidationError('Add at least one ticket type first');
    return this.prisma.event.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
  }

  async myEvents(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) return [];
    return this.prisma.event.findMany({
      where: { organizerId: org.id },
      orderBy: { createdAt: 'desc' },
      include: { ticketTypes: true },
    });
  }

  // ---- admin ----
  adminList(status?: string) {
    return this.prisma.event.findMany({
      where: status ? { status: status as EventStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: { organizer: { select: { name: true } }, ticketTypes: true },
      take: 200,
    });
  }

  async setStatus(actorId: string, id: string, status: EventStatus, reason?: string) {
    const event = await this.prisma.event.update({ where: { id }, data: { status } });
    await this.audit.recordStandalone({
      action: `event.${status.toLowerCase()}`,
      entityType: 'Event',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
      after: { status, reason },
    });
    return event;
  }

  async setFeatured(actorId: string, id: string, featured: boolean) {
    return this.prisma.event.update({ where: { id }, data: { featured } });
  }
}
