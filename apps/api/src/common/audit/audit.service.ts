import { Injectable } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { RequestContextStore } from '../context/request-context';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  actorType?: ActorType;
  actorId?: string | null;
  actorRole?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit trail. `record` MUST be called with the same transaction
 * client as the change it describes, so the audit row commits atomically.
 * Never store secrets, private keys or raw KYC document bytes here.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    const ctx = RequestContextStore.get();
    await tx.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorType: entry.actorType ?? (ctx?.userId ? ActorType.USER : ActorType.SYSTEM),
        actorId: entry.actorId ?? ctx?.userId ?? null,
        actorRole: entry.actorRole ?? ctx?.actorRole ?? null,
        before: entry.before == null ? undefined : (entry.before as Prisma.InputJsonValue),
        after: entry.after == null ? undefined : (entry.after as Prisma.InputJsonValue),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        requestId: ctx?.requestId,
      },
    });
  }

  async recordStandalone(entry: AuditEntry): Promise<void> {
    await this.prisma.runInTransaction((tx) => this.record(tx, entry));
  }
}
