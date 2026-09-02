import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain-errors';
import { toMoneyString } from '../../common/util/decimal';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '-' + Math.random().toString(36).slice(2, 6);
}

@Injectable()
export class OrganizersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async apply(userId: string, name: string, contactEmail?: string, payoutMsisdn?: string) {
    const existing = await this.prisma.organizer.findUnique({ where: { userId } });
    if (existing) throw new ConflictError('ORGANIZER_EXISTS', 'You already have an organizer profile');
    const org = await this.prisma.organizer.create({
      data: { userId, name, slug: slugify(name), status: 'PENDING', contactEmail, payoutMsisdn },
    });
    await this.audit.recordStandalone({ action: 'organizer.applied', entityType: 'Organizer', entityId: org.id, actorId: userId, after: { name } });
    return org;
  }

  async mine(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new NotFoundError('Organizer profile');
    return org;
  }

  async dashboard(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org || org.status !== 'APPROVED') throw new ForbiddenError('Approved organizer profile required');
    const events = await this.prisma.event.findMany({ where: { organizerId: org.id }, select: { id: true } });
    const eventIds = events.map((e) => e.id);
    const [ticketsSold, checkins, orders, settlements] = await Promise.all([
      this.prisma.ticket.count({ where: { eventId: { in: eventIds } } }),
      this.prisma.checkin.count({ where: { eventId: { in: eventIds }, result: 'VALID' } }),
      this.prisma.eventOrder.aggregate({
        where: { eventId: { in: eventIds }, status: 'ISSUED' },
        _sum: { amountGnf: true, organizerNetGnf: true },
      }),
      this.prisma.settlement.groupBy({
        by: ['status'],
        where: { organizerId: org.id },
        _sum: { organizerNetGnf: true, settledGnf: true },
      }),
    ]);
    return {
      organizer: { name: org.name, status: org.status, commissionPct: org.commissionPct },
      events: events.length,
      ticketsSold,
      checkins,
      gmvGnf: toMoneyString(orders._sum.amountGnf ?? 0, 'GNF'),
      organizerRevenueGnf: toMoneyString(orders._sum.organizerNetGnf ?? 0, 'GNF'),
      settlements: settlements.map((s) => ({
        status: s.status,
        netGnf: toMoneyString(s._sum.organizerNetGnf ?? 0, 'GNF'),
        settledGnf: toMoneyString(s._sum.settledGnf ?? 0, 'GNF'),
      })),
    };
  }

  // ---- admin ----
  listAll() {
    return this.prisma.organizer.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { phone: true, firstName: true, lastName: true } } } });
  }

  async setStatus(actorId: string, id: string, status: 'APPROVED' | 'SUSPENDED' | 'PENDING', commissionPct?: string) {
    const org = await this.prisma.organizer.findUnique({ where: { id } });
    if (!org) throw new NotFoundError('Organizer', id);
    await this.prisma.$transaction(async (tx) => {
      await tx.organizer.update({
        where: { id },
        data: { status, ...(commissionPct ? { commissionPct } : {}) },
      });
      if (status === 'APPROVED') {
        const u = await tx.user.findUnique({ where: { id: org.userId } });
        if (u && u.role === 'CUSTOMER') await tx.user.update({ where: { id: org.userId }, data: { role: 'ORGANIZER' } });
      }
      await this.audit.record(tx, {
        action: `organizer.${status.toLowerCase()}`,
        entityType: 'Organizer',
        entityId: id,
        actorType: 'ADMIN',
        actorId,
        after: { status, commissionPct },
      });
    });
    return this.prisma.organizer.findUniqueOrThrow({ where: { id } });
  }
}
