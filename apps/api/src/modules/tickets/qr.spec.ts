import { signQr, verifyQr } from './qr';

const SECRET = 'test-qr-secret-abcdef0123456789';

describe('QR signing', () => {
  it('round-trips a payload', () => {
    const { token } = signQr(SECRET, { ticketId: 't-1', eventId: 'e-1', iat: 1_700_000_000 });
    const p = verifyQr(SECRET, token);
    expect(p).toEqual({ ticketId: 't-1', eventId: 'e-1', iat: 1_700_000_000 });
  });

  it('rejects a tampered body', () => {
    const { token } = signQr(SECRET, { ticketId: 't-1', eventId: 'e-1', iat: 1 });
    const [, sig] = token.split('.');
    const forged = `${Buffer.from('t-2.e-1.1').toString('base64url')}.${sig}`;
    expect(verifyQr(SECRET, forged)).toBeNull();
  });

  it('rejects a wrong signing key', () => {
    const { token } = signQr(SECRET, { ticketId: 't-1', eventId: 'e-1', iat: 1 });
    expect(verifyQr('another-secret-key-000000000000', token)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyQr(SECRET, 'garbage')).toBeNull();
    expect(verifyQr(SECRET, 'a.b.c')).toBeNull();
    expect(verifyQr(SECRET, '')).toBeNull();
  });

  it('does not embed raw ids in clear text', () => {
    const { token } = signQr(SECRET, { ticketId: 'secret-ticket-id', eventId: 'e', iat: 1 });
    expect(token).not.toContain('secret-ticket-id');
  });
});
