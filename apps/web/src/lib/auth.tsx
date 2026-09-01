'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponseDto, UserDto } from '@bn/shared-types';
import { api, tokenStore } from './api-client';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: {
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<UserDto>('/auth/me'));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (phone: string, password: string) => {
    const res = await api.post<AuthResponseDto>('/auth/login', { phone, password }, { auth: false });
    tokenStore.set(res);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (input: { phone: string; password: string; firstName: string; lastName: string }) => {
      const res = await api.post<AuthResponseDto>('/auth/register', input, { auth: false });
      tokenStore.set(res);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    const refresh = tokenStore.refresh;
    if (refresh) void api.post('/auth/logout', { refreshToken: refresh }, { auth: false }).catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
