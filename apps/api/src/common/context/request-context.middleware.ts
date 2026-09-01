import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextStore } from './request-context';

/** Establishes an AsyncLocalStorage scope per request so the audit layer can
 *  attach request id / ip / user agent without threading them through every call. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerId = req.header('x-request-id');
    const requestId = headerId && headerId.length <= 128 ? headerId : randomUUID();
    res.setHeader('x-request-id', requestId);

    RequestContextStore.run(
      {
        requestId,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      },
      () => next(),
    );
  }
}
