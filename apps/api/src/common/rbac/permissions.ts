import { Role } from '@prisma/client';

/**
 * Granular permissions. No blanket admin except SUPER_ADMIN. The matrix below is
 * the single source of truth; changing access is a code change (auditable via
 * git), not a runtime toggle.
 */
export type Permission =
  | 'users.read'
  | 'users.write'
  | 'kyc.read'
  | 'kyc.review'
  | 'pricing.read'
  | 'pricing.write'
  | 'treasury.read'
  | 'treasury.write'
  | 'suppliers.read'
  | 'suppliers.write'
  | 'ledger.read'
  | 'crypto.read'
  | 'crypto.operate'
  | 'payments.read'
  | 'payments.operate'
  | 'payouts.read'
  | 'payouts.operate'
  | 'orange.read'
  | 'orange.operate'
  | 'reconciliation.read'
  | 'reconciliation.resolve'
  | 'events.read'
  | 'events.write'
  | 'events.approve'
  | 'organizers.read'
  | 'organizers.write'
  | 'tickets.read'
  | 'settlements.read'
  | 'settlements.approve'
  | 'checkin.scan'
  | 'audit.read'
  | 'alerts.read'
  | 'alerts.resolve'
  | 'settings.read'
  | 'settings.write'
  | 'system.health'
  | 'mock.operate';

const P = (...p: Permission[]) => p;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ['*' as unknown as Permission], // wildcard, handled in the guard
  OPERATIONS: P(
    'users.read',
    'kyc.read',
    'crypto.read',
    'crypto.operate',
    'payments.read',
    'payments.operate',
    'payouts.read',
    'payouts.operate',
    'orange.read',
    'orange.operate',
    'reconciliation.read',
    'reconciliation.resolve',
    'treasury.read',
    'alerts.read',
    'alerts.resolve',
    'system.health',
    'mock.operate',
  ),
  TREASURY: P(
    'treasury.read',
    'treasury.write',
    'suppliers.read',
    'suppliers.write',
    'pricing.read',
    'pricing.write',
    'ledger.read',
    'crypto.read',
    'payouts.read',
    'alerts.read',
    'system.health',
  ),
  COMPLIANCE: P(
    'users.read',
    'kyc.read',
    'kyc.review',
    'crypto.read',
    'payments.read',
    'reconciliation.read',
    'audit.read',
    'alerts.read',
  ),
  CUSTOMER_SUPPORT: P('users.read', 'kyc.read', 'crypto.read', 'payments.read', 'tickets.read', 'events.read'),
  EVENT_MANAGER: P(
    'events.read',
    'events.write',
    'events.approve',
    'organizers.read',
    'organizers.write',
    'tickets.read',
    'settlements.read',
  ),
  FINANCE: P(
    'ledger.read',
    'treasury.read',
    'settlements.read',
    'settlements.approve',
    'payouts.read',
    'audit.read',
    'crypto.read',
  ),
  AUDITOR: P(
    'users.read',
    'kyc.read',
    'ledger.read',
    'treasury.read',
    'crypto.read',
    'payments.read',
    'payouts.read',
    'reconciliation.read',
    'events.read',
    'tickets.read',
    'settlements.read',
    'audit.read',
    'alerts.read',
    'system.health',
  ),
  ORGANIZER: P('events.read', 'events.write', 'tickets.read', 'settlements.read'),
  SCANNER_OPERATOR: P('checkin.scan', 'events.read', 'tickets.read'),
  CUSTOMER: [],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  if (role === 'SUPER_ADMIN') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
