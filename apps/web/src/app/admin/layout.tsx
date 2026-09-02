'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const NAV: [string, string][] = [
  ['/admin', 'Tableau de bord'],
  ['/admin/crypto', 'Ordres crypto'],
  ['/admin/payments', 'Paiements'],
  ['/admin/payouts', 'Versements'],
  ['/admin/reconciliation', 'Réconciliation'],
  ['/admin/treasury', 'Trésorerie'],
  ['/admin/ledger', 'Grand livre'],
  ['/admin/suppliers', 'Fournisseurs USDT'],
  ['/admin/pricing', 'Tarification'],
  ['/admin/orange', 'Orange Money'],
  ['/admin/users', 'Utilisateurs'],
  ['/admin/kyc', 'KYC'],
  ['/admin/events', 'Événements'],
  ['/admin/organizers', 'Organisateurs'],
  ['/admin/settlements', 'Règlements'],
  ['/admin/alerts', 'Alertes'],
  ['/admin/audit', 'Journaux'],
  ['/admin/system', 'Santé système'],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role === 'CUSTOMER')) router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || user.role === 'CUSTOMER') {
    return <div className="p-10 text-center text-muted">Accès réservé…</div>;
  }

  return (
    <div className="flex min-h-screen bg-ivory">
      <aside className="hidden w-56 shrink-0 border-r border-black/5 bg-surface p-3 md:block">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-[10px] font-bold text-white">
            B&amp;N
          </span>
          <span className="text-sm font-bold text-forest">Admin</span>
        </Link>
        <nav className="space-y-0.5">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`block rounded-lg px-3 py-1.5 text-sm ${
                pathname === href ? 'bg-forest text-white' : 'text-muted hover:bg-forest-tint'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-x-auto">
        <header className="flex items-center justify-between border-b border-black/5 bg-surface px-5 py-3 md:hidden">
          <span className="font-bold text-forest">Admin</span>
        </header>
        <div className="mx-auto max-w-5xl p-5">{children}</div>
      </div>
    </div>
  );
}
