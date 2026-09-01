'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Paginated, UserDto } from '@bn/shared-types';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

const ROLES = ['USER', 'ADMIN', 'TREASURY_OPS', 'COMPLIANCE'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_KYC'];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<Paginated<UserDto>>('/admin/users?pageSize=50');
    setUsers(res.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, patch: Partial<Pick<UserDto, 'role' | 'status'>>) {
    setMsg(null);
    try {
      await api.patch(`/admin/users/${id}`, patch);
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {users.map((u) => (
        <div key={u.id} className="card">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {u.firstName} {u.lastName}
            </span>
            <span className="text-xs text-muted">{u.phone}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            KYC {u.kycLevel} · inscrit {formatDateTime(u.createdAt)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select className="field" value={u.role} onChange={(e) => update(u.id, { role: e.target.value as UserDto['role'] })}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <select
              className="field"
              value={u.status}
              onChange={(e) => update(u.id, { status: e.target.value as UserDto['status'] })}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
