/** Preferred Ops display name for report rows (matches web displayStaff). */
export function formatStaffReportName(input: {
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
}): string {
  return input.useDisplayName && input.displayName.trim()
    ? input.displayName.trim()
    : input.legalName;
}

/** Neutral fallback when staff.role is empty. */
export function formatStaffReportRole(role: string | null | undefined): string {
  const trimmed = role?.trim();
  return trimmed ? trimmed : '—';
}
