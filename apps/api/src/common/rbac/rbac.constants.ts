export const IS_PUBLIC_KEY = 'bn:isPublic';
export const ROLES_KEY = 'bn:roles';

export interface AuthUser {
  id: string;
  phone: string;
  role: 'USER' | 'ADMIN' | 'TREASURY_OPS' | 'COMPLIANCE';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_KYC';
  kycLevel: 'NONE' | 'BASIC' | 'FULL';
}

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: AuthUser['role'];
  type: 'access';
}
