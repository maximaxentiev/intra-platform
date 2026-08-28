/** Authoritative staff document categories for Phase 3+. */
export const STAFF_DOCUMENT_TYPE_VALUES = [
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunizations',
  'covid19_vaccination',
  'eca_diploma',
  'ece_diploma',
  'rece_proof',
] as const;

export type StaffDocumentType = (typeof STAFF_DOCUMENT_TYPE_VALUES)[number];

/** Required for compliance, onboarding Step 2, and shift eligibility. */
export const REQUIRED_STAFF_DOCUMENT_TYPES = [
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunizations',
] as const satisfies readonly StaffDocumentType[];

export type RequiredStaffDocumentType = (typeof REQUIRED_STAFF_DOCUMENT_TYPES)[number];

/** Optional qualification credentials — never block onboarding or general shift document gates. */
export const QUALIFICATION_STAFF_DOCUMENT_TYPES = [
  'eca_diploma',
  'ece_diploma',
  'rece_proof',
] as const satisfies readonly StaffDocumentType[];

export type QualificationStaffDocumentType = (typeof QUALIFICATION_STAFF_DOCUMENT_TYPES)[number];

/** Optional — never blocks onboarding or Approved staff list status. */
export const OPTIONAL_STAFF_DOCUMENT_TYPES = [
  'covid19_vaccination',
  ...QUALIFICATION_STAFF_DOCUMENT_TYPES,
] as const satisfies readonly StaffDocumentType[];

/** Compliance documents shown in the primary Carer/Ops document sections (excludes qualifications). */
export const STAFF_COMPLIANCE_DOCUMENT_TYPES = [
  ...REQUIRED_STAFF_DOCUMENT_TYPES,
  'covid19_vaccination',
] as const satisfies readonly StaffDocumentType[];

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
  'expired',
  'expiring_soon',
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

/** Future reminder offsets in days before expiry — Vulnerable Sector Check only. */
export const VSC_REMINDER_OFFSETS_DAYS = [30, 14, 7, 3, 1] as const;

/** Future reminder offsets in calendar months before expiry — First Aid / CPR only. */
export const FIRST_AID_REMINDER_OFFSETS_MONTHS = [3, 2, 1] as const;

/** @deprecated Use VSC_REMINDER_OFFSETS_DAYS — retained for VSC day-based reminder code paths. */
export const STAFF_DOCUMENT_REMINDER_OFFSETS_DAYS = VSC_REMINDER_OFFSETS_DAYS;

/** Default public-share policy — all categories may appear when live eligibility passes. */
export const STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE: Record<StaffDocumentType, boolean> = {
  vulnerable_sector_check: true,
  first_aid_cpr: true,
  immunizations: true,
  covid19_vaccination: true,
  eca_diploma: true,
  ece_diploma: true,
  rece_proof: true,
};

export function isRequiredStaffDocumentType(type: StaffDocumentType): type is RequiredStaffDocumentType {
  return (REQUIRED_STAFF_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function isQualificationStaffDocumentType(
  type: StaffDocumentType,
): type is QualificationStaffDocumentType {
  return (QUALIFICATION_STAFF_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function isStaffDocumentReminderType(type: StaffDocumentType): boolean {
  return (STAFF_DOCUMENT_REMINDER_TYPES as readonly string[]).includes(type);
}

/** True when a document category may appear on the public staff share page (Phase 3I). */
export function isStaffDocumentPublicShareType(type: StaffDocumentType): boolean {
  return STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE[type];
}

/** Role-based qualification visibility for the Carer portal. */
export function qualificationTypesForStaffRole(role: string | null | undefined): QualificationStaffDocumentType[] {
  const normalized = (role ?? '').trim();
  if (normalized === 'ECA') return ['eca_diploma'];
  if (normalized === 'ECE') return ['ece_diploma', 'rece_proof'];
  return [];
}
