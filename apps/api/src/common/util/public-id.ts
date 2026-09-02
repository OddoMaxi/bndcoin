import { customAlphabet } from 'nanoid';

const alnum = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 10);
const digits = customAlphabet('0123456789', 6);

export const quotePublicId = () => `QT-${alnum()}`;
export const cryptoOrderPublicId = () => `BN-${alnum()}`;
export const paymentIntentPublicId = () => `PI-${alnum()}`;
export const payoutPublicId = () => `PO-${alnum()}`;
export const supplyPublicId = () => `SUP-${alnum()}`;
export const eventOrderPublicId = () => `EVT-${alnum()}`;
export const ticketPublicId = () => `TK-${alnum()}${alnum()}`;
export const settlementPublicId = () => `STL-${alnum()}`;
export const publicUserId = () => `U-${alnum()}`;
export const otpCode = () => digits();
