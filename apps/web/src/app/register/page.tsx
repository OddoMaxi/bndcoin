'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '+224',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, phone: form.phone.trim() });
      router.push('/buy');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h1 className="text-xl font-bold">Créer un compte</h1>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prénom</label>
          <input className="field" value={form.firstName} onChange={set('firstName')} required />
        </div>
        <div>
          <label className="label">Nom</label>
          <input className="field" value={form.lastName} onChange={set('lastName')} required />
        </div>
      </div>
      <div>
        <label className="label">Téléphone (+224…)</label>
        <input className="field" value={form.phone} onChange={set('phone')} inputMode="tel" required />
      </div>
      <div>
        <label className="label">Mot de passe (8 caractères min.)</label>
        <input
          className="field"
          type="password"
          value={form.password}
          onChange={set('password')}
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? '…' : 'Créer mon compte'}
      </button>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-semibold text-forest">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
