import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { RequestContextStore } from '../context/request-context';
import { DomainError } from './domain-errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = RequestContextStore.get()?.requestId;

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof DomainError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        code = (b.error as string)?.toUpperCase?.().replace(/\s+/g, '_') ?? 'HTTP_ERROR';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        code = 'UNIQUE_CONSTRAINT';
        message = `Duplicate value for ${(exception.meta?.target as string[])?.join(', ') ?? 'field'}`;
      } else if (exception.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
      } else {
        status = 400;
        code = `PRISMA_${exception.code}`;
        message = 'Database request error';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    res.status(status).json({
      statusCode: status,
      error: code,
      message,
      code,
      requestId,
    });
  }
}
