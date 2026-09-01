import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AuthUser } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  IdempotencyConflictError,
  IdempotencyKeyMismatchError,
} from '../errors/domain-errors';
import { IDEMPOTENT_KEY } from './idempotency.decorator';

const TTL_HOURS = 24;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const marked = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = req.header('idempotency-key');
    if (!key || key.length < 6 || key.length > 200) {
      throw new BadRequestException(
        'This endpoint requires a unique "Idempotency-Key" header (6-200 chars)',
      );
    }

    const requestHash = createHash('sha256')
      .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    return from(this.begin(key, req, requestHash)).pipe(
      switchMap((prior) => {
        if (prior === 'replay') {
          return from(this.replay(key, res));
        }
        return next.handle().pipe(
          tap({
            next: (body) => {
              void this.complete(key, res.statusCode || 201, body);
            },
            error: () => {
              void this.abort(key);
            },
          }),
        );
      }),
    );
  }

  private async begin(
    key: string,
    req: Request & { user?: AuthUser },
    requestHash: string,
  ): Promise<'proceed' | 'replay'> {
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new IdempotencyKeyMismatchError();
      if (existing.status === 'IN_PROGRESS') throw new IdempotencyConflictError();
      return 'replay';
    }
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          userId: req.user?.id,
          method: req.method,
          path: req.originalUrl,
          requestHash,
          status: 'IN_PROGRESS',
          expiresAt: new Date(Date.now() + TTL_HOURS * 3_600_000),
        },
      });
      return 'proceed';
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Lost the race to another concurrent request with the same key.
        throw new IdempotencyConflictError();
      }
      throw err;
    }
  }

  private async replay(key: string, res: Response): Promise<unknown> {
    const record = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    res.status(record?.responseStatus ?? 200);
    res.setHeader('idempotent-replay', 'true');
    return record?.responseBody ?? null;
  }

  private async complete(key: string, status: number, body: unknown): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'COMPLETED',
        responseStatus: status,
        responseBody: body == null ? Prisma.JsonNull : (body as Prisma.InputJsonValue),
      },
    });
  }

  private async abort(key: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({ where: { key, status: 'IN_PROGRESS' } });
  }
}
