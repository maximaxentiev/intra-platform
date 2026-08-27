/** Active shift role requirements for new Shift creation. */
export const ACTIVE_SHIFT_ROLES = ['ECA', 'ECE', 'RECE'] as const;

export type ActiveShiftRole = (typeof ACTIVE_SHIFT_ROLES)[number];

/** Legacy shift roles that may still exist on historical rows. */
export const LEGACY_SHIFT_ROLES = ['Nanny'] as const;

export type LegacyShiftRole = (typeof LEGACY_SHIFT_ROLES)[number];

export type NormalizedShiftRole = ActiveShiftRole | LegacyShiftRole | string;

/** Canonical shift role for matching/display, preserving legacy values when unknown. */
export function normalizeShiftRole(roleNeeded: string | null | undefined): string | null {
  const trimmed = (roleNeeded ?? '').trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper === 'ECA') return 'ECA';
  if (upper === 'ECE') return 'ECE';
  if (upper === 'RECE') return 'RECE';
  if (upper === 'NANNY' || trimmed === 'Nanny') return 'Nanny';

  return trimmed;
}

export function isActiveShiftRole(role: string | null | undefined): role is ActiveShiftRole {
  const normalized = normalizeShiftRole(role);
  return normalized != null && (ACTIVE_SHIFT_ROLES as readonly string[]).includes(normalized);
}

/** Human-readable Ops label for shift role surfaces. */
export function formatShiftRoleLabel(roleNeeded: string | null | undefined): string {
  const normalized = normalizeShiftRole(roleNeeded);
  return normalized ?? '—';
}
