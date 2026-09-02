import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermission } from '../../common/rbac/decorators';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

class AuditQuery extends PaginationQuery {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
}

@ApiTags('audit-logs')
@RequirePermission('audit.read')
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: AuditQuery) {
    const where = {
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: { contains: q.action } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(
      items.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actorType: a.actorType,
        actorId: a.actorId,
        actorRole: a.actorRole,
        before: a.before,
        after: a.after,
        requestId: a.requestId,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      q,
    );
  }
}
