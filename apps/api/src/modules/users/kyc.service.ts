import { Injectable } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { paginated, PaginationQuery } from '../../common/dto/pagination.dto';

export interface KycSubmitInput {
  identityDocumentType: string;
  identityDocumentNumber: string;
  identityDocumentFront: string; // storage key / data-ref (bytes are NOT stored in audit)
  identityDocumentBack?: string;
  selfie?: string;
  dateOfBirth?: string;
  address?: string;
  country?: string;
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMine(userId: string) {
    const rec = await this.prisma.kycRecord.findUnique({
      where: { userId },
      include: { reviews: { orderBy: { createdAt: 'desc' } } },
    });
    if (!rec) throw new NotFoundError('KYC record');
    return this.toDto(rec);
  }

  private toDto(rec: any) {
    return {
      status: rec.status,
      identityDocumentType: rec.identityDocumentType,
      identityDocumentNumber: rec.identityDocumentNumber ? mask(rec.identityDocumentNumber) : null,
      hasFront: !!rec.identityDocumentFront,
      hasBack: !!rec.identityDocumentBack,
      hasSelfie: !!rec.selfie,
      submittedAt: rec.submittedAt?.toISOString() ?? null,
      decidedAt: rec.decidedAt?.toISOString() ?? null,
      reviews: (rec.reviews ?? []).map((r: any) => ({
        decision: r.decision,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async submit(userId: string, input: KycSubmitInput) {
    const rec = await this.prisma.kycRecord.findUnique({ where: { userId } });
    if (!rec) throw new NotFoundError('KYC record');
    if (rec.status === 'VERIFIED') throw new ValidationError('KYC already verified');

    await this.prisma.$transaction(async (tx) => {
      await tx.kycRecord.update({
        where: { userId },
        data: {
          status: 'PENDING',
          identityDocumentType: input.identityDocumentType,
          identityDocumentNumber: input.identityDocumentNumber,
          identityDocumentFront: input.identityDocumentFront,
          identityDocumentBack: input.identityDocumentBack,
          selfie: input.selfie,
          submittedAt: new Date(),
        },
      });
      const userData: Record<string, unknown> = { kycStatus: 'PENDING', status: 'PENDING_KYC' };
      if (input.dateOfBirth) userData.dateOfBirth = new Date(input.dateOfBirth);
      if (input.address) userData.address = input.address;
      if (input.country) userData.country = input.country;
      await tx.user.update({ where: { id: userId }, data: userData });
      await this.audit.record(tx, {
        action: 'kyc.submitted',
        entityType: 'KycRecord',
        entityId: rec.id,
        actorId: userId,
        after: { status: 'PENDING', documentType: input.identityDocumentType },
      });
    });
    return this.getMine(userId);
  }

  // --- admin ---
  async adminList(q: PaginationQuery & { status?: string }) {
    const where = q.status ? { status: q.status as KycStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.kycRecord.findMany({
        where,
        include: { user: true },
        orderBy: { submittedAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.kycRecord.count({ where }),
    ]);
    return paginated(
      items.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: `${r.user.firstName} ${r.user.lastName}`,
        phone: r.user.phone,
        status: r.status,
        documentType: r.identityDocumentType,
        documentNumber: r.identityDocumentNumber ? mask(r.identityDocumentNumber) : null,
        submittedAt: r.submittedAt?.toISOString() ?? null,
      })),
      total,
      q,
    );
  }

  async review(reviewerId: string, kycRecordId: string, decision: KycStatus, reason?: string) {
    if (!['VERIFIED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(decision)) {
      throw new ValidationError('Invalid KYC decision');
    }
    const rec = await this.prisma.kycRecord.findUnique({ where: { id: kycRecordId } });
    if (!rec) throw new NotFoundError('KycRecord', kycRecordId);

    await this.prisma.$transaction(async (tx) => {
      await tx.kycReview.create({
        data: {
          kycRecordId,
          reviewerId,
          decision,
          reason,
          snapshot: { previousStatus: rec.status },
        },
      });
      await tx.kycRecord.update({
        where: { id: kycRecordId },
        data: { status: decision, decidedAt: new Date() },
      });
      const kycLevel = decision === 'VERIFIED' ? 'FULL' : undefined;
      await tx.user.update({
        where: { id: rec.userId },
        data: {
          kycStatus: decision,
          ...(kycLevel ? { kycLevel } : {}),
          status: decision === 'VERIFIED' ? 'ACTIVE' : decision === 'SUSPENDED' ? 'SUSPENDED' : 'PENDING_KYC',
        },
      });
      await this.audit.record(tx, {
        action: 'kyc.reviewed',
        entityType: 'KycRecord',
        entityId: kycRecordId,
        actorType: 'ADMIN',
        actorId: reviewerId,
        before: { status: rec.status },
        after: { status: decision, reason: reason ?? null },
      });
    });
    return { ok: true, status: decision };
  }
}

function mask(v: string): string {
  if (v.length <= 4) return '****';
  return `${'*'.repeat(v.length - 4)}${v.slice(-4)}`;
}
