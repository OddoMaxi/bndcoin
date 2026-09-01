import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  set(patch: Partial<RequestContext>): void {
    const current = storage.getStore();
    if (current) Object.assign(current, patch);
  },
};
