/** Authoritative staff document categories for Phase 3+. */
export const STAFF_DOCUMENT_TYPE_VALUES = [
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunizations',
  'covid19_vaccination',
] as const;

export type StaffDocumentType = (typeof STAFF_DOCUMENT_TYPE_VALUES)[number];

/** Required for compliance, onboarding Step 2, and shift eligibility. */
export const REQUIRED_STAFF_DOCUMENT_TYPES = [
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunizations',
] as const satisfies readonly StaffDocumentType[];

export type RequiredStaffDocumentType = (typeof REQUIRED_STAFF_DOCUMENT_TYPES)[number];

/** Optional — never blocks onboarding or Approved staff list status. */
export const OPTIONAL_STAFF_DOCUMENT_TYPES = ['covid19_vaccination'] as const satisfies readonly StaffDocumentType[];

export const STAFF_DOCUMENT_REVIEW_STATUS_VALUES = [
  'pending_review',
  'approved',
  'issue_flagged',
] as const;

export type StaffDocumentReviewStatus = (typeof STAFF_DOCUMENT_REVIEW_STATUS_VALUES)[number];

/** Derived when no current submission with files exists. */
export type StaffDocumentReviewStatusOrNotSubmitted =
  | StaffDocumentReviewStatus
  | 'not_submitted';

export const STAFF_DOCUMENT_EXPIRY_DISPLAY_VALUES = [
  'no_expiry',
  'current',
  'expiring_soon',
  'expired',
] as const;

export type StaffDocumentExpiryDisplay = (typeof STAFF_DOCUMENT_EXPIRY_DISPLAY_VALUES)[number];

export const STAFF_DOCUMENT_LIST_STATUS_VALUES = [
  'no_documents_submitted',
  'pending_review',
  'warning',
  'approved',
] as const;

export type StaffDocumentListStatus = (typeof STAFF_DOCUMENT_LIST_STATUS_VALUES)[number];

export const SHIFT_DOCUMENT_INELIGIBILITY_REASONS = [
  'missing_required_submission',
  'pending_review',
  'issue_flagged',
  'expired',
] as const;

export type ShiftDocumentIneligibilityReason =
  (typeof SHIFT_DOCUMENT_INELIGIBILITY_REASONS)[number];

/** Categories that support automated expiry reminders (Phase 7). */
export const STAFF_DOCUMENT_REMINDER_TYPES = [
  'vulnerable_sector_check',
  'first_aid_cpr',
] as const satisfies readonly StaffDocumentType[];

/** Future reminder offsets in days before expiry (Communications phase). */
export const STAFF_DOCUMENT_REMINDER_OFFSETS_DAYS = [30, 14, 7, 3, 1] as const;

/** Default public-share policy (Phase 3I) — schema only until product approves otherwise. */
export const STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE: Record<StaffDocumentType, boolean> = {
  vulnerable_sector_check: true,
  first_aid_cpr: true,
  immunizations: false,
  covid19_vaccination: false,
};

export function isRequiredStaffDocumentType(type: StaffDocumentType): type is RequiredStaffDocumentType {
  return (REQUIRED_STAFF_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function isStaffDocumentReminderType(type: StaffDocumentType): boolean {
  return (STAFF_DOCUMENT_REMINDER_TYPES as readonly string[]).includes(type);
}

/** True when a document category may appear on the public staff share page (Phase 3I). */
export function isStaffDocumentPublicShareType(type: StaffDocumentType): boolean {
  return STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE[type];
}
