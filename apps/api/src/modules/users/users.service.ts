import { Injectable } from '@nestjs/common';
import { Asset, QuoteSide } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotFoundError, ValidationError } from '../../common/errors/domain-errors';
import { paginated, PaginationQuery } from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/util/decimal';
import { toUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    return toUserDto(user);
  }

  async updateMe(id: string, dto: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const k of ['firstName', 'lastName', 'email', 'address', 'country']) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth as string);
    const user = await this.prisma.user.update({ where: { id }, data });
    return toUserDto(user);
  }

  /** Effective per-transaction limits for a user by KYC level, with the global cap as fallback. */
  async effectiveLimits(userId: string, currency: Asset = 'GNF') {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const limit =
      (await this.prisma.transactionLimit.findFirst({
        where: { scope: 'KYC_LEVEL', refId: user.kycLevel, currency, active: true },
      })) ??
      (await this.prisma.transactionLimit.findFirst({
        where: { scope: 'GLOBAL', refId: '*', currency, active: true },
      }));
    return limit;
  }

  async getLimitsDto(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const limit = await this.effectiveLimits(userId, 'GNF');
    if (!limit) return { currency: 'GNF', kycLevel: user.kycLevel };
    return {
      currency: 'GNF' as const,
      kycLevel: user.kycLevel,
      perTxMin: toMoneyString(limit.perTxMin, 'GNF'),
      perTxMax: toMoneyString(limit.perTxMax, 'GNF'),
      dailyMax: toMoneyString(limit.dailyMax, 'GNF'),
      monthlyMax: toMoneyString(limit.monthlyMax, 'GNF'),
    };
  }

  /** Throws if `gnfAmount` breaches the user's per-tx / rolling limits for the given side. */
  async assertWithinLimits(userId: string, gnfAmount: string, _side: QuoteSide) {
    const limit = await this.effectiveLimits(userId, 'GNF');
    if (!limit) return;
    const amount = Money.of(gnfAmount, 'GNF');
    if (amount.lt(Money.of(limit.perTxMin.toFixed(), 'GNF'))) {
      throw new ValidationError('Amount is below your per-transaction minimum');
    }
    if (amount.gt(Money.of(limit.perTxMax.toFixed(), 'GNF'))) {
      throw new ValidationError('Amount exceeds your per-transaction limit for your KYC level');
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todays = await this.prisma.cryptoOrder.aggregate({
      where: { userId, createdAt: { gte: dayStart }, status: { notIn: ['FAILED', 'EXPIRED', 'CANCELLED'] } },
      _sum: { gnfAmount: true },
    });
    const used = Money.of(todays._sum.gnfAmount?.toFixed() ?? '0', 'GNF');
    if (used.add(amount).gt(Money.of(limit.dailyMax.toFixed(), 'GNF'))) {
      throw new ValidationError('This would exceed your daily limit');
    }
  }

  // --- admin ---
  async adminList(q: PaginationQuery & { search?: string }) {
    const where = q.search
      ? {
          OR: [
            { phone: { contains: q.search, mode: 'insensitive' as const } },
            { email: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
            { publicUserId: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items.map(toUserDto), total, q);
  }

  async adminUpdate(actorId: string, id: string, dto: Record<string, unknown>) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('User', id);
    const data: Record<string, unknown> = {};
    for (const k of ['role', 'status', 'kycLevel', 'riskLevel']) if (dto[k] !== undefined) data[k] = dto[k];
    const user = await this.prisma.user.update({ where: { id }, data });
    await this.audit.recordStandalone({
      action: 'user.admin_updated',
      entityType: 'User',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
      before: { role: before.role, status: before.status, kycLevel: before.kycLevel, riskLevel: before.riskLevel },
      after: { role: user.role, status: user.status, kycLevel: user.kycLevel, riskLevel: user.riskLevel },
    });
    return toUserDto(user);
  }
}
