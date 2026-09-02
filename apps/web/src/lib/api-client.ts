'use client';

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
  set(t: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, t.accessToken);
    localStorage.setItem(REFRESH_KEY, t.refreshToken);
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

interface Opts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
}

async function raw<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
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

async function withRefresh<T>(path: string, opts: Opts): Promise<T> {
  try {
    return await raw<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && tokenStore.refresh && opts.auth !== false) {
      try {
        const r = await raw<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          auth: false,
          body: { refreshToken: tokenStore.refresh },
        });
        tokenStore.set(r);
        return await raw<T>(path, opts);
      } catch {
        tokenStore.clear();
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(p: string, o: Opts = {}) => withRefresh<T>(p, { ...o, method: 'GET' }),
  post: <T>(p: string, body?: unknown, o: Opts = {}) => withRefresh<T>(p, { ...o, method: 'POST', body }),
  patch: <T>(p: string, body?: unknown, o: Opts = {}) => withRefresh<T>(p, { ...o, method: 'PATCH', body }),
  put: <T>(p: string, body?: unknown, o: Opts = {}) => withRefresh<T>(p, { ...o, method: 'PUT', body }),
};

export const newKey = () => `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const MOCK_ENABLED = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';
