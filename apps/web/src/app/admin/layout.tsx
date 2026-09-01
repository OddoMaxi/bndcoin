'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const TABS = [
  ['/admin', 'Résumé'],
  ['/admin/transactions', 'Transactions'],
  ['/admin/quotes', 'Devis'],
  ['/admin/treasury', 'Trésorerie'],
  ['/admin/users', 'Utilisateurs'],
  ['/admin/review', 'Revue'],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role === 'USER')) router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || user.role === 'USER') {
    return <p className="text-muted">Accès réservé…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              pathname === href ? 'bg-gold text-ink' : 'text-muted hover:bg-gold-soft/40'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
