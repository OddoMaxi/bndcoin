'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

export interface Col<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  title: string;
  url: string;
  columns: Col<T>[];
  pick?: (data: any) => T[];
  actions?: (row: T, reload: () => void) => React.ReactNode;
  filters?: React.ReactNode;
  intervalMs?: number;
}

export function AdminTable<T extends Record<string, any>>({
  title,
  url,
  columns,
  pick,
  actions,
  filters,
  intervalMs,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<any>(url);
      const arr = pick ? pick(data) : Array.isArray(data) ? data : (data.items ?? []);
      setRows(arr);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, pick]);

  useEffect(() => {
    void load();
    if (intervalMs) {
      const t = setInterval(load, intervalMs);
      return () => clearInterval(t);
    }
  }, [load, intervalMs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{title}</h1>
        <div className="flex items-center gap-2">{filters}</div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              {actions && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">
                  Aucune donnée
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id ?? i} className="border-t border-black/5">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 align-top">
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
                {actions && <td className="px-3 py-2 text-right">{actions(row, load)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function adminAction(path: string, body?: unknown) {
  try {
    await api.post(path, body ?? {});
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
