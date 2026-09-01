import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotFoundError } from '../../common/errors/domain-errors';
import { paginated } from '../../common/dto/pagination.dto';
import { toMoneyString } from '../../common/util/decimal';
import { toUserDto } from './user.mapper';
import { AdminUpdateUserDto, ListUsersQuery, UpdateMeDto } from './dto';

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

  async updateMe(id: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return toUserDto(user);
  }

  /** Effective GNF limits for a user, derived from their KYC level + the global cap. */
  async getLimits(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [kycLimit, globalLimit] = await Promise.all([
      this.prisma.transactionLimit.findFirst({
        where: { scope: 'KYC_LEVEL', refId: user.kycLevel, currency: 'GNF', active: true },
      }),
      this.prisma.transactionLimit.findFirst({
        where: { scope: 'GLOBAL', currency: 'GNF', active: true },
      }),
    ]);
    const source = kycLimit ?? globalLimit;
    if (!source) {
      return { currency: 'GNF', perTxMin: null, perTxMax: null, dailyMax: null, monthlyMax: null };
    }
    return {
      currency: 'GNF' as const,
      kycLevel: user.kycLevel,
      perTxMin: toMoneyString(source.perTxMin, 'GNF'),
      perTxMax: toMoneyString(source.perTxMax, 'GNF'),
      dailyMax: toMoneyString(source.dailyMax, 'GNF'),
      monthlyMax: toMoneyString(source.monthlyMax, 'GNF'),
    };
  }

  async adminList(q: ListUsersQuery) {
    const where = q.search
      ? {
          OR: [
            { phone: { contains: q.search, mode: 'insensitive' as const } },
            { email: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items.map(toUserDto), total, q);
  }

  async adminUpdate(actorId: string, id: string, dto: AdminUpdateUserDto) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('User', id);
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    await this.audit.recordStandalone({
      action: 'user.admin_updated',
      entityType: 'User',
      entityId: id,
      actorType: 'ADMIN',
      actorId,
      before: { role: before.role, status: before.status, kycLevel: before.kycLevel },
      after: { role: user.role, status: user.status, kycLevel: user.kycLevel },
    });
    return toUserDto(user);
  }
}
