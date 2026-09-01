'use client';

import type { AuthResponseDto } from '@bn/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const ACCESS_KEY = 'bn.accessToken';
const REFRESH_KEY = 'bn.refreshToken';

export const tokenStore = {
  get access() {
    return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
}

async function raw<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(res.status, message ?? res.statusText, data?.code);
  }
  return data as T;
}

async function withRefresh<T>(path: string, opts: RequestOptions): Promise<T> {
  try {
    return await raw<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && tokenStore.refresh && opts.auth !== false) {
      try {
        const refreshed = await raw<AuthResponseDto>('/auth/refresh', {
          method: 'POST',
          auth: false,
          body: { refreshToken: tokenStore.refresh },
        });
        tokenStore.set(refreshed);
        return await raw<T>(path, opts);
      } catch {
        tokenStore.clear();
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts: RequestOptions = {}) => withRefresh<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    withRefresh<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    withRefresh<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    withRefresh<T>(path, { ...opts, method: 'PUT', body }),
};

export function newIdempotencyKey(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const MOCK_ENABLED = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';
