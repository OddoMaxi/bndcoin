import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Compact signed QR token. Payload carries only opaque ids (no PII):
 *   base64url("<ticketId>.<eventId>.<issuedAtSec>") + "." + base64url(HMAC-SHA256)
 * The scanner verifies the signature offline-capable, then confirms state online.
 */
export interface QrPayload {
  ticketId: string;
  eventId: string;
  iat: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signQr(secret: string, payload: QrPayload): { token: string; signature: string } {
  const body = `${payload.ticketId}.${payload.eventId}.${payload.iat}`;
  const bodyB64 = b64url(Buffer.from(body));
  const sig = createHmac('sha256', secret).update(bodyB64).digest();
  const sigB64 = b64url(sig);
  return { token: `${bodyB64}.${sigB64}`, signature: sigB64 };
}

export function verifyQr(secret: string, token: string): QrPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [bodyB64, sigB64] = parts;
  const expected = createHmac('sha256', secret).update(bodyB64).digest();
  const provided = fromB64url(sigB64);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const body = fromB64url(bodyB64).toString('utf8').split('.');
  if (body.length !== 3) return null;
  return { ticketId: body[0], eventId: body[1], iat: Number(body[2]) };
}
