import {
  REQUIRED_STAFF_DOCUMENT_TYPES,
  type RequiredStaffDocumentType,
  type ShiftDocumentIneligibilityReason,
  type StaffDocumentListStatus,
  type StaffDocumentReviewStatusOrNotSubmitted,
  type StaffDocumentType,
} from './staff-document.constants';
import {
  deriveExpiryDisplay,
  type StaffDocumentExpiryDisplay,
} from './staff-document-dates.util';

/** Input shape for pure compliance calculation (DB layer maps rows to this in 3B). */
export interface StaffDocumentCategoryComplianceInput {
  documentType: StaffDocumentType;
  /** Current submission has at least one file. */
  isSubmitted: boolean;
  reviewStatus: StaffDocumentReviewStatusOrNotSubmitted;
  expiryDate: string | null;
  processedDate: string | null;
  fileCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  remindersEnabled: boolean;
  currentSubmissionId: string | null;
  /** When set, this submission is obsolete for reminders/compliance driving. */
  supersededAt: string | null;
}

export interface StaffDocumentCategoryCompliance extends StaffDocumentCategoryComplianceInput {
  expiryDisplay: StaffDocumentExpiryDisplay;
}

export interface StaffShiftDocumentGate {
  eligible: boolean;
  reasons: ShiftDocumentIneligibilityReason[];
  documentStatus: StaffDocumentListStatus;
  categories: StaffDocumentCategoryCompliance[];
}

function enrichCategory(
  input: StaffDocumentCategoryComplianceInput,
  asOfDate?: Date,
): StaffDocumentCategoryCompliance {
  return {
    ...input,
    expiryDisplay: deriveExpiryDisplay(input.expiryDate, asOfDate),
  };
}

export function buildCategoryComplianceMap(
  inputs: StaffDocumentCategoryComplianceInput[],
  asOfDate?: Date,
): Map<StaffDocumentType, StaffDocumentCategoryCompliance> {
  return new Map(inputs.map((row) => [row.documentType, enrichCategory(row, asOfDate)]));
}

export function complianceForRequiredCategories(
  inputs: StaffDocumentCategoryComplianceInput[],
  asOfDate?: Date,
): StaffDocumentCategoryCompliance[] {
  const map = buildCategoryComplianceMap(inputs, asOfDate);
  return REQUIRED_STAFF_DOCUMENT_TYPES.map((type) => {
    const existing = map.get(type);
    if (existing) return existing;
    return enrichCategory(
      {
        documentType: type,
        isSubmitted: false,
        reviewStatus: 'not_submitted',
        expiryDate: null,
        processedDate: null,
        fileCount: 0,
        submittedAt: null,
        reviewedAt: null,
        remindersEnabled: true,
        currentSubmissionId: null,
        supersededAt: null,
      },
      asOfDate,
    );
  });
}

/**
 * Staff list Document Status — deterministic priority (first match wins).
 * COVID optional — ignored here.
 */
export function deriveStaffDocumentListStatus(
  required: StaffDocumentCategoryCompliance[],
): StaffDocumentListStatus {
  const submitted = required.filter((c) => c.isSubmitted);

  if (submitted.length === 0) {
    return 'no_documents_submitted';
  }

  const allSubmitted = required.every((c) => c.isSubmitted);
  const allApproved = allSubmitted && required.every((c) => c.reviewStatus === 'approved');

  if (!allSubmitted) {
    return 'pending_review';
  }

  if (required.some((c) => c.reviewStatus === 'pending_review' || c.reviewStatus === 'issue_flagged')) {
    return 'pending_review';
  }

  if (
    allApproved &&
    required.some(
      (c) => c.expiryDisplay === 'expiring_soon' || c.expiryDisplay === 'expired',
    )
  ) {
    return 'warning';
  }

  if (allApproved) {
    return 'approved';
  }

  return 'pending_review';
}

function ineligibilityReasonForCategory(
  category: StaffDocumentCategoryCompliance,
): ShiftDocumentIneligibilityReason | null {
  if (!category.isSubmitted || category.reviewStatus === 'not_submitted') {
    return 'missing_required_submission';
  }
  if (category.reviewStatus === 'pending_review') {
    return 'pending_review';
  }
  if (category.reviewStatus === 'issue_flagged') {
    return 'issue_flagged';
  }
  if (category.expiryDisplay === 'expired') {
    return 'expired';
  }
  return null;
}

/**
 * Shift matching gate — expiring_soon remains eligible.
 * Uses current (non-superseded) submission state supplied by caller.
 */
export function deriveStaffShiftDocumentGate(
  inputs: StaffDocumentCategoryComplianceInput[],
  asOfDate?: Date,
): StaffShiftDocumentGate {
  const required = complianceForRequiredCategories(inputs, asOfDate);
  const reasons: ShiftDocumentIneligibilityReason[] = [];

  for (const category of required) {
    const reason = ineligibilityReasonForCategory(category);
    if (reason && !reasons.includes(reason)) {
      reasons.push(reason);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    documentStatus: deriveStaffDocumentListStatus(required),
    categories: required,
  };
}

/** Whether set.current_submission_id drives reminders (Phase 7 contract). */
export function isActiveReminderSubmission(
  set: { currentSubmissionId: string | null },
  submission: { id: string; supersededAt: string | null },
): boolean {
  return (
    set.currentSubmissionId === submission.id &&
    submission.supersededAt === null
  );
}

export type { RequiredStaffDocumentType };
