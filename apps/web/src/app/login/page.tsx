'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+224');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await requestOtp(phone.trim());
      setHint(r.debugCode ? `Code de démonstration : ${r.debugCode}` : 'Code envoyé par SMS.');
      setStep('otp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone.trim(), code.trim());
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-6">
      <h1 className="text-xl font-bold">Connexion</h1>
      {step === 'phone' ? (
        <form onSubmit={sendOtp} className="card space-y-4">
          <div>
            <label className="label">Numéro de téléphone</label>
            <input
              className="field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+224 6XX XX XX XX"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : 'Recevoir un code'}
          </button>
          <p className="text-center text-xs text-muted">
            Pas de mot de passe. Nous vous envoyons un code à usage unique.
          </p>
        </form>
      ) : (
        <form onSubmit={confirm} className="card space-y-4">
          <p className="text-sm text-muted">Code envoyé au {phone}</p>
          {hint && <p className="rounded-lg bg-forest-tint px-3 py-2 text-sm text-forest">{hint}</p>}
          <input
            className="field text-center text-2xl tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? '…' : 'Se connecter'}
          </button>
          <button type="button" className="w-full text-sm text-muted" onClick={() => setStep('phone')}>
            Changer de numéro
          </button>
        </form>
      )}
      <p className="text-center text-xs text-muted">
        <Link href="/" className="font-medium text-forest">
          Retour à l’accueil
        </Link>
      </p>
    </div>
  );
}
