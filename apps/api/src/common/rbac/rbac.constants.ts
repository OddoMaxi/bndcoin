import { Role } from '@prisma/client';

export const IS_PUBLIC_KEY = 'bn:isPublic';
export const ROLES_KEY = 'bn:roles';
export const PERMS_KEY = 'bn:perms';

export interface AuthUser {
  id: string;
  publicUserId: string;
  phone: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_KYC' | 'CLOSED';
  kycLevel: 'NONE' | 'BASIC' | 'FULL';
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  sessionId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
  sid?: string;
  type: 'access';
}
