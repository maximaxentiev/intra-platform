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

/** Shift role label for reports/exports — preserves RECE and legacy values. */
export function formatShiftRoleForReport(roleNeeded: string | null | undefined): string {
  const trimmed = roleNeeded?.trim();
  return trimmed ? trimmed : '—';
}
