'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { human } from '@/lib/format';
import { Card } from '@/components/ui';

interface Kyc {
  status: string;
  reviews: { decision: string; reason: string | null; createdAt: string }[];
}
interface Limits {
  perTxMax?: string;
  dailyMax?: string;
  kycLevel: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [kyc, setKyc] = useState<Kyc | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [form, setForm] = useState({ identityDocumentType: 'CNI', identityDocumentNumber: '', identityDocumentFront: 'demo-front' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    api.get<Kyc>('/kyc/me').then(setKyc).catch(() => {});
    api.get<Limits>('/users/me/limits').then(setLimits).catch(() => {});
  }, [user]);

  async function submitKyc(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.post<Kyc>('/kyc/submit', form);
      setKyc(r);
      setMsg('Dossier envoyé. Vérification sous 24–48h.');
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  if (loading || !user) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>
      <Card>
        <p className="text-lg font-semibold">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-sm text-muted">{user.phone}</p>
        <p className="mt-1 text-xs text-muted">
          ID {user.publicUserId} · rôle {human(user.role)}
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Vérification d’identité (KYC)</h2>
          <span className="pill bg-forest-tint text-forest">{human(kyc?.status ?? 'UNVERIFIED')}</span>
        </div>
        {limits && (
          <p className="mt-1 text-xs text-muted">
            Niveau {limits.kycLevel} · plafond {limits.perTxMax ? Number(limits.perTxMax).toLocaleString('fr-GN') : '—'} GNF / transaction
          </p>
        )}
        {kyc?.status === 'UNVERIFIED' || kyc?.status === 'REJECTED' ? (
          <form onSubmit={submitKyc} className="mt-3 space-y-3">
            <select
              className="field"
              value={form.identityDocumentType}
              onChange={(e) => setForm({ ...form, identityDocumentType: e.target.value })}
            >
              <option value="CNI">Carte nationale d’identité</option>
              <option value="PASSPORT">Passeport</option>
              <option value="PERMIS">Permis de conduire</option>
            </select>
            <input
              className="field"
              placeholder="Numéro du document"
              value={form.identityDocumentNumber}
              onChange={(e) => setForm({ ...form, identityDocumentNumber: e.target.value })}
              required
            />
            <button className="btn-primary w-full">Envoyer pour vérification</button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {kyc?.status === 'PENDING' ? 'Dossier en cours de vérification.' : 'Identité vérifiée.'}
          </p>
        )}
        {msg && <p className="mt-2 text-sm text-forest">{msg}</p>}
      </Card>

      <button className="btn-ghost w-full" onClick={logout}>
        Se déconnecter
      </button>
      <p className="text-center text-xs text-muted">
        <Link href="/" className="text-forest">
          Accueil
        </Link>
      </p>
    </div>
  );
}
