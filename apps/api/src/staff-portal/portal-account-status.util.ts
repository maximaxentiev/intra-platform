import type { StaffAccount } from '../db/schema';

/** Ops-facing portal account status labels. */
export type PortalAccountDisplayStatus =
  | 'no_account'
  | 'invited'
  | 'incomplete'
  | 'active'
  | 'disabled';

export function resolvePortalAccountDisplayStatus(
  account: StaffAccount | null | undefined,
): PortalAccountDisplayStatus {
  if (!account) return 'no_account';
  if (account.status === 'disabled') return 'disabled';
  if (account.onboardingCompletedAt) return 'active';
  if (account.passwordHash) return 'incomplete';
  return 'invited';
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}
