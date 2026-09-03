import { getStaffLegalFullName, type ReportExportAudience } from '@intra/shared';

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

export type CarerNameForReportInput = {
  legalFirstName?: string | null;
  legalLastName?: string | null;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
};

/**
 * Canonical carer name for CSV exports.
 * Ops → display name when enabled; Centre → legal full name with legacy fallbacks.
 */
export function formatCarerNameForReport(
  staff: CarerNameForReportInput,
  audience: ReportExportAudience = 'ops',
): string {
  if (audience === 'centre') {
    const legal = getStaffLegalFullName(staff);
    if (legal) return legal;
    const displayFallback = formatStaffReportName(staff).trim();
    return displayFallback || '—';
  }
  return formatStaffReportName(staff);
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
