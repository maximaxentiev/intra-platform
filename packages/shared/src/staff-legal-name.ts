/** Staff fields used to derive the external-facing legal full name. */
export type StaffLegalNameInput = {
  legalFirstName?: string | null;
  legalLastName?: string | null;
  legalName?: string | null;
};

/**
 * Canonical external Staff name — legal first + legal last only.
 * Never uses displayName. Falls back to legalName when first/last are empty.
 */
export function getStaffLegalFullName(staff: StaffLegalNameInput): string {
  const first = (staff.legalFirstName ?? '').trim();
  const last = (staff.legalLastName ?? '').trim();
  const composed = `${first} ${last}`.trim();
  if (composed) return composed;
  return (staff.legalName ?? '').trim();
}
