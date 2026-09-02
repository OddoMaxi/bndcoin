'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api-client';

export interface Me {
  id: string;
  publicUserId: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  kycStatus: string;
  kycLevel: string;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<{ debugCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  loginPassword: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);
const isAdminRole = (r: string) => r !== 'CUSTOMER';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<Me>('/auth/me'));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestOtp = useCallback(async (phone: string) => {
    return api.post<{ debugCode?: string }>('/auth/otp/request', { phone }, { auth: false });
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: Me }>(
      '/auth/otp/verify',
      { phone, code, deviceLabel: 'web' },
      { auth: false },
    );
    tokenStore.set(res);
    setUser(res.user);
  }, []);

  const loginPassword = useCallback(async (phone: string, password: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: Me }>(
      '/auth/login',
      { phone, password },
      { auth: false },
    );
    tokenStore.set(res);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    const r = tokenStore.refresh;
    if (r) void api.post('/auth/logout', { refreshToken: r }, { auth: false }).catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, requestOtp, verifyOtp, loginPassword, logout, refresh }),
    [user, loading, requestOtp, verifyOtp, loginPassword, logout, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}

export { isAdminRole };
