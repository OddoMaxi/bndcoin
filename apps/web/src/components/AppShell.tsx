'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Accueil' },
  { href: '/buy', label: 'Acheter' },
  { href: '/transactions', label: 'Transactions' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user && user.role !== 'USER';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-app flex-col">
      <header className="flex items-center justify-between px-5 pt-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-white">
            B&amp;N
          </span>
          <span className="text-lg font-bold tracking-tight text-forest">Bory &amp; Norbert</span>
        </Link>
        {user ? (
          <button onClick={logout} className="text-sm font-medium text-muted hover:text-ink">
            Déconnexion
          </button>
        ) : (
          <Link href="/login" className="text-sm font-semibold text-forest">
            Connexion
          </Link>
        )}
      </header>

      <nav className="flex gap-1 px-5 pt-4">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? 'bg-forest text-white' : 'text-muted hover:bg-forest-tint'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              pathname.startsWith('/admin') ? 'bg-gold text-ink' : 'text-gold hover:bg-gold-soft/40'
            }`}
          >
            Admin
          </Link>
        )}
      </nav>

      <main className="flex-1 px-5 py-5">{children}</main>

      <footer className="px-5 pb-6 pt-2 text-center text-xs text-muted">
        Bory &amp; Norbert — plateforme USDT pour la Guinée. Environnement de démonstration.
      </footer>
    </div>
  );
}
