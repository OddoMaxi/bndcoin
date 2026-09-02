'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAdminRole, useAuth } from '@/lib/auth';

const TABS = [
  { href: '/', label: 'Accueil', icon: '⌂' },
  { href: '/crypto', label: 'Crypto', icon: '⇄' },
  { href: '/events', label: 'Événements', icon: '★' },
  { href: '/activity', label: 'Activité', icon: '≡' },
  { href: '/profile', label: 'Profil', icon: '●' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  if (pathname?.startsWith('/scan') || pathname?.startsWith('/admin')) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-app flex-col pb-20">
      <header className="flex items-center justify-between px-5 pt-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-xs font-bold text-white">
            B&amp;N
          </span>
          <span className="text-base font-bold tracking-tight text-forest">Bory &amp; Norbert</span>
        </Link>
        {user && isAdminRole(user.role) && (
          <Link href="/admin" className="rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold">
            Admin
          </Link>
        )}
        {!user && (
          <Link href="/login" className="text-sm font-semibold text-forest">
            Connexion
          </Link>
        )}
      </header>

      <main className="flex-1 px-5 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app justify-around border-t border-black/5 bg-surface/95 px-2 py-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${
                active ? 'text-forest' : 'text-muted'
              }`}
            >
              <span className={`text-base ${active ? 'opacity-100' : 'opacity-60'}`}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
