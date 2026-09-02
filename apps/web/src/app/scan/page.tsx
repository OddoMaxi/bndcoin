'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';

interface Ev {
  id: string;
  title: string;
  venue: string;
}
interface ScanResult {
  result: string;
  message: string;
  ticketType?: string;
  usedAt?: string | null;
  usedGate?: string | null;
}

const TONE: Record<string, string> = {
  VALID: 'bg-forest text-white',
  ALREADY_USED: 'bg-amber-500 text-white',
  WRONG_EVENT: 'bg-amber-500 text-white',
  INVALID: 'bg-red-600 text-white',
  BLOCKED: 'bg-red-600 text-white',
};

export default function ScanPage() {
  const { user, loading, loginPassword, logout } = useAuth();
  const [phone, setPhone] = useState('+224600000006');
  const [password, setPassword] = useState('');
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventId, setEventId] = useState('');
  const [gate, setGate] = useState('A');
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (user && (user.role === 'SCANNER_OPERATOR' || user.role === 'ORGANIZER' || user.role === 'EVENT_MANAGER' || user.role === 'SUPER_ADMIN')) {
      api.get<Ev[]>('/scanner/events').then((e) => {
        setEvents(e);
        if (e[0]) setEventId(e[0].id);
      });
    }
  }, [user]);

  const submit = useCallback(
    async (token: string) => {
      if (!token || !eventId || busy) return;
      setBusy(true);
      try {
        const r = await api.post<ScanResult>('/scanner/scan', { eventId, gate, qrToken: token });
        setResult(r);
        if (navigator.vibrate) navigator.vibrate(r.result === 'VALID' ? 80 : [40, 40, 40]);
      } catch (e) {
        setResult({ result: 'INVALID', message: (e as Error).message });
      } finally {
        setBusy(false);
        setTimeout(() => setResult(null), 4000);
      }
    },
    [eventId, gate, busy],
  );

  const tick = useCallback(() => {
    const v = videoRef.current;
    if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code?.data) {
        void submit(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [submit]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      setResult({ result: 'INVALID', message: 'Caméra indisponible — utilisez la saisie manuelle.' });
    }
  }
  function stopCamera() {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  }
  useEffect(() => () => stopCamera(), []);

  if (loading) return <div className="p-8 text-center text-muted">…</div>;

  if (!user) {
    return (
      <div className="mx-auto min-h-screen max-w-sm bg-forest p-6 text-white">
        <h1 className="mb-6 mt-10 text-2xl font-bold">Scanner B&amp;N</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await loginPassword(phone.trim(), password);
          }}
          className="space-y-3"
        >
          <input className="field text-ink" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
          <input
            className="field text-ink"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
          />
          <button className="btn-gold w-full">Connexion agent</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm bg-ink text-white">
      <header className="flex items-center justify-between p-4">
        <span className="font-bold">Scanner</span>
        <button onClick={logout} className="text-xs text-white/60">
          Quitter
        </button>
      </header>
      <div className="space-y-3 p-4">
        <select className="field text-ink" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {['A', 'B', 'C', 'VIP'].map((g) => (
            <button
              key={g}
              onClick={() => setGate(g)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${gate === g ? 'bg-gold text-ink' : 'bg-white/10'}`}
            >
              Porte {g}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          {result && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${TONE[result.result] ?? 'bg-red-600'}`}>
              <p className="text-3xl font-extrabold">{result.result === 'VALID' ? '✓' : '✕'}</p>
              <p className="mt-2 text-lg font-bold">{result.message}</p>
              {result.ticketType && <p className="text-sm">{result.ticketType}</p>}
              {result.usedAt && <p className="mt-1 text-xs opacity-80">{new Date(result.usedAt).toLocaleString('fr-FR')}</p>}
            </div>
          )}
        </div>

        {scanning ? (
          <button className="btn-ghost w-full border-white/30 text-white" onClick={stopCamera}>
            Arrêter la caméra
          </button>
        ) : (
          <button className="btn-primary w-full" onClick={startCamera}>
            Scanner avec la caméra
          </button>
        )}

        <div className="flex gap-2">
          <input
            className="field text-ink"
            placeholder="Coller un code manuellement"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn-gold" onClick={() => submit(manual.trim())}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
