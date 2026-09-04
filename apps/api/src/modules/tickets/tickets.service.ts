import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CheckinResult, EventOrder } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { LedgerService } from '../../common/ledger/ledger.service';
import { NotificationsService } from '../../common/notifications/notifications.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-errors';
import { eventOrderPublicId, ticketPublicId } from '../../common/util/public-id';
import { decimalToString } from '../../common/util/decimal';
import { PaymentsService } from '../payments/payments.service';
import { SettlementsService } from '../settlements/settlements.service';
import { signQr, verifyQr } from './qr';

interface OrderItemInput {
  ticketTypeId: string;
  quantity: number;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly lock: RedisLockService,
    private readonly payments: PaymentsService,
    private readonly settlements: SettlementsService,
  ) {}

  private entity(id: string) {
    return this.prisma.eventOrder.findUniqueOrThrow({ where: { id } });
  }

  // ---- checkout ----
  async createOrder(userId: string, eventId: string, items: OrderItemInput[], currency: 'GNF' | 'USDT') {
    if (!items.length) throw new ValidationError('Select at least one ticket');
    return this.prisma.runInTransaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { organizer: true } });
      if (!event || event.status !== 'PUBLISHED') throw new NotFoundError('Event', eventId);
      if (event.salesEnd && event.salesEnd < new Date()) throw new ValidationError('Ticket sales have ended');

      let subtotal = Money.zero('GNF');
      const orderItems: { ticketTypeId: string; quantity: number; unitPriceGnf: string }[] = [];

      for (const item of items) {
        if (item.quantity < 1) continue;
        // atomic inventory reservation
        await tx.$executeRawUnsafe('SELECT 1 FROM "TicketType" WHERE "id" = $1 FOR UPDATE', item.ticketTypeId);
        const tt = await tx.ticketType.findUnique({ where: { id: item.ticketTypeId } });
        if (!tt || tt.eventId !== eventId || tt.status !== 'ACTIVE') {
          throw new ValidationError('Ticket type unavailable');
        }
        if (item.quantity > tt.maxPerOrder) throw new ValidationError(`Max ${tt.maxPerOrder} per order for ${tt.name}`);
        if (tt.quantitySold + item.quantity > tt.quantity) {
          throw new ValidationError(`Not enough ${tt.name} tickets left`);
        }
        await tx.ticketType.update({
          where: { id: tt.id },
          data: {
            quantitySold: { increment: item.quantity },
            status: tt.quantitySold + item.quantity >= tt.quantity ? 'SOLD_OUT' : tt.status,
          },
        });
        subtotal = subtotal.add(Money.of(decimalToString(tt.priceGnf), 'GNF').mul(String(item.quantity)));
        orderItems.push({ ticketTypeId: tt.id, quantity: item.quantity, unitPriceGnf: decimalToString(tt.priceGnf) });
      }
      if (orderItems.length === 0) throw new ValidationError('Nothing to purchase');

      const commissionPct = decimalToString(event.organizer.commissionPct);
      const platformFee = subtotal.mul(commissionPct).quantize();
      const organizerNet = subtotal.sub(platformFee);

      const order = await tx.eventOrder.create({
        data: {
          publicId: eventOrderPublicId(),
          userId,
          eventId,
          status: 'CREATED',
          currency,
          subtotalGnf: subtotal.toString(),
          amountGnf: subtotal.toString(),
          platformFeeGnf: platformFee.toString(),
          organizerNetGnf: organizerNet.toString(),
          expiresAt: new Date(Date.now() + 15 * 60_000),
          items: { create: orderItems },
        },
      });

      let paymentRef: string | null = null;
      if (currency === 'GNF') {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const intent = await this.payments.createIntent(tx, {
          refType: 'event_order',
          refId: order.id,
          userId,
          amountGnf: subtotal.toString(),
          customerPhone: user.phone,
        });
        await tx.eventOrder.update({ where: { id: order.id }, data: { paymentIntentId: intent.id, status: 'AWAITING_PAYMENT' } });
        paymentRef = intent.id;
      } else {
        // USDT checkout: caller is directed to send USDT; watched like a SELL deposit.
        await tx.eventOrder.update({ where: { id: order.id }, data: { status: 'AWAITING_PAYMENT' } });
      }
      await this.audit.record(tx, {
        action: 'event_order.created',
        entityType: 'EventOrder',
        entityId: order.id,
        actorId: userId,
        after: { eventId, subtotal: subtotal.toString(), currency },
      });
      const fresh = await tx.eventOrder.findUniqueOrThrow({ where: { id: order.id } });
      return { order: fresh, paymentIntentId: paymentRef };
    });
  }

  async startPayment(orderId: string) {
    const order = await this.entity(orderId);
    if (order.paymentIntentId) await this.payments.startCollection(order.paymentIntentId);
  }

  /** Idempotent: poll payment, issue tickets once verified. */
  async driveOrder(orderId: string): Promise<EventOrder> {
    return this.lock.withLock(`event-order:${orderId}`, async () => {
      const order = await this.entity(orderId);
      if (['ISSUED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].includes(order.status)) return order;

      if (order.currency === 'GNF' && order.paymentIntentId) {
        const status = await this.payments.pollIntent(order.paymentIntentId);
        if (status === 'PAYMENT_VERIFIED') return this.issueTickets(orderId);
        if (status === 'PAYMENT_REJECTED' || status === 'EXPIRED') {
          return this.failOrder(orderId, `payment ${status.toLowerCase()}`);
        }
        return order;
      }
      return order; // USDT flow driven via mock-control in this build
    });
  }

  private async failOrder(orderId: string, reason: string): Promise<EventOrder> {
    return this.prisma.runInTransaction(async (tx) => {
      const order = await tx.eventOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      if (['ISSUED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(order.status)) return order;
      // release reserved inventory
      for (const it of order.items) {
        await tx.ticketType.update({
          where: { id: it.ticketTypeId },
          data: { quantitySold: { decrement: it.quantity }, status: 'ACTIVE' },
        });
      }
      const updated = await tx.eventOrder.update({ where: { id: orderId }, data: { status: 'FAILED' } });
      await this.audit.record(tx, { action: 'event_order.failed', entityType: 'EventOrder', entityId: orderId, after: { reason } });
      return updated;
    });
  }

  private async issueTickets(orderId: string): Promise<EventOrder> {
    return this.prisma.runInTransaction(async (tx) => {
      const order = await tx.eventOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, event: { include: { organizer: true } } },
      });
      if (order.status === 'ISSUED') return order;

      for (const it of order.items) {
        for (let i = 0; i < it.quantity; i++) {
          const ticketId = randomUUID();
          const { token, signature } = signQr(this.config.qrSigningSecret, {
            ticketId,
            eventId: order.eventId,
            iat: Math.floor(Date.now() / 1000),
          });
          await tx.ticket.create({
            data: {
              id: ticketId,
              publicTicketId: ticketPublicId(),
              eventId: order.eventId,
              ticketTypeId: it.ticketTypeId,
              userId: order.userId,
              orderId: order.id,
              qrToken: token,
              signature,
              status: 'VALID',
            },
          });
        }
      }

      const updated = await tx.eventOrder.update({
        where: { id: orderId },
        data: { status: 'ISSUED', paidAt: new Date() },
      });

      // Ledger: funds in (GNF PDV), split platform fee vs organiser payable.
      const gross = Money.of(decimalToString(order.amountGnf), 'GNF');
      const fee = Money.of(decimalToString(order.platformFeeGnf), 'GNF');
      const net = Money.of(decimalToString(order.organizerNetGnf), 'GNF');
      const assetAccount = order.currency === 'GNF' ? 'GNF_PDV_01' : 'USDT_HOT_WALLET';
      if (order.currency === 'GNF') {
        await this.ledger.post(tx, {
          reference: `event_order:${order.publicId}`,
          referenceType: 'event_order',
          referenceId: orderId,
          memo: 'Ticket sale settlement',
          lines: [
            { account: assetAccount, currency: 'GNF', direction: 'DEBIT', amount: gross.toString() },
            { account: 'ORGANIZER_PAYABLE', currency: 'GNF', direction: 'CREDIT', amount: net.toString() },
            { account: 'PLATFORM_REVENUE', currency: 'GNF', direction: 'CREDIT', amount: fee.toString() },
          ].filter((l) => !Money.of(l.amount, 'GNF').isZero()),
        });
      }

      await this.settlements.accrue(tx, {
        organizerId: order.event.organizerId,
        eventId: order.eventId,
        grossGnf: gross.toString(),
        platformFeeGnf: fee.toString(),
        organizerNetGnf: net.toString(),
      });

      await this.audit.record(tx, {
        action: 'event_order.issued',
        entityType: 'EventOrder',
        entityId: orderId,
        after: { tickets: order.items.reduce((s, i) => s + i.quantity, 0) },
      });
      await this.notifications.send({
        userId: order.userId,
        channel: 'SMS',
        template: 'TICKET_ISSUED',
        destination: '',
        payload: { orderId: order.publicId },
      });
      return updated;
    });
  }

  // ---- user reads ----
  async myTickets(userId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      include: { event: { select: { title: true, slug: true, eventDate: true, venue: true, city: true } }, ticketType: { select: { name: true } } },
    });
    return tickets.map((t) => ({
      id: t.id,
      publicTicketId: t.publicTicketId,
      status: t.status,
      qrToken: t.status === 'VALID' ? t.qrToken : null,
      ticketType: t.ticketType.name,
      event: { title: t.event.title, slug: t.event.slug, date: t.event.eventDate.toISOString(), venue: t.event.venue, city: t.event.city },
      usedAt: t.usedAt?.toISOString() ?? null,
    }));
  }

  async ticketDetail(userId: string, id: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: { event: true, ticketType: true },
    });
    if (!t) throw new NotFoundError('Ticket', id);
    if (t.userId !== userId) throw new ForbiddenError('This ticket belongs to another user');
    return {
      id: t.id,
      publicTicketId: t.publicTicketId,
      status: t.status,
      qrToken: t.status === 'VALID' ? t.qrToken : null,
      ticketType: t.ticketType.name,
      event: { title: t.event.title, date: t.event.eventDate.toISOString(), venue: t.event.venue, address: t.event.address, city: t.event.city },
      usedAt: t.usedAt?.toISOString() ?? null,
      usedGate: t.usedGate,
    };
  }

  async myOrders(userId: string) {
    return this.prisma.eventOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { title: true, slug: true } } },
      take: 50,
    });
  }

  // ---- check-in (first valid scan wins, multi-gate safe) ----
  async checkIn(scannerUserId: string, eventId: string, gate: string, qrToken: string) {
    const payload = verifyQr(this.config.qrSigningSecret, qrToken);
    if (!payload) {
      return { result: 'INVALID' as CheckinResult, message: 'Signature invalide' };
    }
    if (payload.eventId !== eventId) {
      await this.recordCheckin(payload.ticketId, eventId, gate, scannerUserId, 'WRONG_EVENT');
      return { result: 'WRONG_EVENT' as CheckinResult, message: 'Billet pour un autre événement' };
    }

    // Atomic conditional transition — only one gate can win.
    const affected = await this.prisma.$executeRaw`
      UPDATE "Ticket"
      SET "status" = 'USED', "usedAt" = now(), "usedGate" = ${gate}, "usedBy" = ${scannerUserId}
      WHERE "id" = ${payload.ticketId} AND "status" = 'VALID'`;

    if (affected === 1) {
      await this.recordCheckin(payload.ticketId, eventId, gate, scannerUserId, 'VALID');
      const t = await this.prisma.ticket.findUnique({ where: { id: payload.ticketId }, include: { ticketType: true } });
      return { result: 'VALID' as CheckinResult, message: 'Bienvenue', ticketType: t?.ticketType.name };
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: payload.ticketId } });
    if (!ticket) {
      return { result: 'INVALID' as CheckinResult, message: 'Billet introuvable' };
    }
    if (ticket.status === 'USED') {
      await this.recordCheckin(payload.ticketId, eventId, gate, scannerUserId, 'ALREADY_USED');
      return {
        result: 'ALREADY_USED' as CheckinResult,
        message: 'Billet déjà utilisé',
        usedAt: ticket.usedAt?.toISOString() ?? null,
        usedGate: ticket.usedGate,
      };
    }
    await this.recordCheckin(payload.ticketId, eventId, gate, scannerUserId, 'BLOCKED');
    return { result: 'BLOCKED' as CheckinResult, message: `Billet ${ticket.status}` };
  }

  private async recordCheckin(
    ticketId: string,
    eventId: string,
    gate: string,
    scannedBy: string,
    result: CheckinResult,
  ) {
    await this.prisma.checkin
      .create({ data: { ticketId, eventId, gate, scannedBy, result } })
      .catch(() => undefined);
  }

  async scannerEvents(scannerUserId: string) {
    // scanner operators see published + upcoming events; organisers see their own.
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: scannerUserId } });
    if (user.role === 'ORGANIZER') {
      const org = await this.prisma.organizer.findUnique({ where: { userId: scannerUserId } });
      return this.prisma.event.findMany({
        where: { organizerId: org?.id, status: { in: ['PUBLISHED', 'COMPLETED'] } },
        select: { id: true, title: true, eventDate: true, venue: true },
        orderBy: { eventDate: 'asc' },
      });
    }
    return this.prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, eventDate: true, venue: true },
      orderBy: { eventDate: 'asc' },
      take: 100,
    });
  }

  async eventCheckinStats(eventId: string) {
    const [total, used] = await Promise.all([
      this.prisma.ticket.count({ where: { eventId, status: { in: ['VALID', 'USED'] } } }),
      this.prisma.ticket.count({ where: { eventId, status: 'USED' } }),
    ]);
    return { total, used, remaining: total - used };
  }

  // ---- admin ----
  adminTickets(eventId?: string) {
    return this.prisma.ticket.findMany({
      where: eventId ? { eventId } : {},
      orderBy: { issuedAt: 'desc' },
      take: 200,
      include: { event: { select: { title: true } }, ticketType: { select: { name: true } }, user: { select: { phone: true } } },
    });
  }
}

