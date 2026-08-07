/** Canonical staff employment roles stored on `staff.role`. */
export const STAFF_CANONICAL_ROLES = ['ECA', 'ECE', 'Nanny'] as const;

export type StaffCanonicalRole = (typeof STAFF_CANONICAL_ROLES)[number];

export const STAFF_ROLE_ERROR_MESSAGE = 'Role must be ECA, ECE, or Nanny.';

function normalizeStaffRoleToken(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** CSV / application-style aliases → canonical staff role. Unknown values return null. */
const STAFF_ROLE_ALIASES: Record<string, StaffCanonicalRole> = {
  eca: 'ECA',
  ece: 'ECE',
  rece: 'ECE',
  'ece/rece': 'ECE',
  'ece / rece': 'ECE',
  nanny: 'Nanny',
};

export function normalizeStaffRoleFromCsv(raw: string): StaffCanonicalRole | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === 'ECA' || trimmed === 'ECE' || trimmed === 'Nanny') {
    return trimmed;
  }
  const token = normalizeStaffRoleToken(raw);
  return STAFF_ROLE_ALIASES[token] ?? null;
}

export function isStaffCanonicalRole(value: string): value is StaffCanonicalRole {
  return (STAFF_CANONICAL_ROLES as readonly string[]).includes(value);
}
