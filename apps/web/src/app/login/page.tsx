'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('+224610000000');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
      router.push('/buy');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h1 className="text-xl font-bold">Connexion</h1>
      <div>
        <label className="label">Numéro de téléphone</label>
        <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
      <div>
        <label className="label">Mot de passe</label>
        <input
          className="field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? '…' : 'Se connecter'}
      </button>
      <p className="text-center text-sm text-muted">
        Pas de compte ?{' '}
        <Link href="/register" className="font-semibold text-forest">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
