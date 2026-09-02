import { Injectable, Logger } from '@nestjs/common';
import { AlertSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AlertCode =
  | 'USDT_LOW'
  | 'GNF_LOW'
  | 'PDV_BALANCE_LOW'
  | 'MODEM_OFFLINE'
  | 'PAYMENT_STUCK'
  | 'PAYOUT_STUCK'
  | 'LEDGER_MISMATCH'
  | 'BLOCKCHAIN_WATCHER_DOWN'
  | 'HIGH_FAILED_PAYMENT_RATE'
  | 'SUPPLIER_STOCK_PENDING'
  | 'EVENT_OVERSALE_RISK'
  | 'HIGH_PENDING_EXPOSURE'
  | 'RECONCILIATION_REQUIRED';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Raise an alert unless an identical OPEN one already exists (dedupe by code+message). */
  async raise(
    severity: AlertSeverity,
    code: AlertCode,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.prisma.alert.findFirst({
      where: { code, message, status: 'OPEN' },
    });
    if (existing) return;
    await this.prisma.alert.create({
      data: { severity, code, message, context: context as never },
    });
    this.logger.warn(`[alert:${severity}] ${code} — ${message}`);
  }

  async resolve(id: string, resolvedBy?: string): Promise<void> {
    await this.prisma.alert.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy },
    });
  }

  async list(status?: string) {
    return this.prisma.alert.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
