import { customAlphabet } from 'nanoid';

// No look-alike characters (0/O, 1/I/L).
const nanoid = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 10);

export function quotePublicId(): string {
  return `QT-${nanoid()}`;
}

export function transactionPublicId(): string {
  return `BN-${nanoid()}`;
}
