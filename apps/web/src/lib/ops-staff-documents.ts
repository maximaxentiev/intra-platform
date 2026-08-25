import { api, ApiError } from "@/lib/api";
import {
  buildCategorySaveFormData,
  CARER_DOCUMENT_CATEGORY_META,
  categoryDraftFromCategory,
  categoryDraftDirty,
  deriveVscRenewalDueDate,
  expiryDisplayLabel,
  formatDocumentByteSize,
  formatDocumentDate,
  formatVscRenewalDueLabel,
  mapDocumentsApiError,
  reviewStatusLabel,
  STAFF_COMPLIANCE_DOCUMENT_TYPES,
  QUALIFICATION_STAFF_DOCUMENT_TYPES,
  STAFF_DOCUMENT_TYPES,
  validateCategoryDraft,
  type CarerDocumentCategory,
  type CarerDocumentFile,
  type CarerDocumentsList,
  type CategoryDraft,
  type StaffDocumentType,
} from "@/lib/carer-documents";

export type StaffDocumentListStatus =
  | "no_documents_submitted"
  | "pending_review"
  | "warning"
  | "approved";

export type ShiftEligibilityReason =
  | "missing_required_submission"
  | "pending_review"
  | "issue_flagged"
  | "expired"
  | "qualification_required"
  | "rece_required";

export type OpsStaffDocumentsList = CarerDocumentsList & {
  staffId: string;
};

export const STAFF_DOCUMENT_LIST_STATUS_LABELS: Record<StaffDocumentListStatus, string> = {
  no_documents_submitted: "No Documents Submitted",
  pending_review: "Pending Review",
  warning: "Warning",
  approved: "Approved",
};

export const SHIFT_ELIGIBILITY_REASON_LABELS: Record<ShiftEligibilityReason, string> = {
  missing_required_submission: "Missing required document submission",
  pending_review: "Document pending review",
  issue_flagged: "Document issue flagged",
  expired: "Required document expired",
  qualification_required: "Centre qualification requirement not met",
  rece_required: "RECE proof required for this centre",
};

export function staffDocumentListStatusLabel(status: string): string {
  return (
    STAFF_DOCUMENT_LIST_STATUS_LABELS[status as StaffDocumentListStatus] ??
    status.replace(/_/g, " ")
  );
}

export function shiftEligibilityReasonLabel(reason: string): string {
  return SHIFT_ELIGIBILITY_REASON_LABELS[reason as ShiftEligibilityReason] ?? reason.replace(/_/g, " ");
}

export function isStaleSubmissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

export function mapOpsDocumentsApiError(err: unknown, fallback: string): string {
  if (isStaleSubmissionError(err)) {
    return "This submission has been replaced. Refreshing the latest documents.";
  }
  return mapDocumentsApiError(err, fallback);
}

export function opsStaffDocumentContentPath(input: {
  staffId: string;
  documentType: StaffDocumentType;
  fileId: string;
}): string {
  return `/staff/${input.staffId}/documents/${input.documentType}/files/${input.fileId}/content`;
}

export const opsStaffDocumentsApi = {
  get: (staffId: string) => api.get<OpsStaffDocumentsList>(`/staff/${staffId}/documents`),

  saveCategory: (staffId: string, documentType: StaffDocumentType, formData: FormData) =>
    api.postForm<OpsStaffDocumentsList>(`/staff/${staffId}/documents/${documentType}`, formData),

  approveSubmission: (
    staffId: string,
    documentType: StaffDocumentType,
    submissionId: string,
  ) =>
    api.post<OpsStaffDocumentsList>(
      `/staff/${staffId}/documents/${documentType}/submissions/${submissionId}/approve`,
    ),

  flagIssue: (
    staffId: string,
    documentType: StaffDocumentType,
    submissionId: string,
    issueNote: string,
  ) =>
    api.post<OpsStaffDocumentsList>(
      `/staff/${staffId}/documents/${documentType}/submissions/${submissionId}/flag-issue`,
      { issueNote },
    ),

  clearCategory: (staffId: string, documentType: StaffDocumentType) =>
    api.del<OpsStaffDocumentsList>(`/staff/${staffId}/documents/${documentType}`),
};

export function buildOpsCategorySaveFormData(
  documentType: StaffDocumentType,
  draft: CategoryDraft,
): FormData {
  return buildCategorySaveFormData(documentType, draft);
}

export {
  CARER_DOCUMENT_CATEGORY_META,
  categoryDraftFromCategory,
  categoryDraftDirty,
  deriveVscRenewalDueDate,
  expiryDisplayLabel,
  formatDocumentByteSize,
  formatDocumentDate,
  formatVscRenewalDueLabel,
  reviewStatusLabel,
  STAFF_COMPLIANCE_DOCUMENT_TYPES,
  QUALIFICATION_STAFF_DOCUMENT_TYPES,
  STAFF_DOCUMENT_TYPES,
  validateCategoryDraft,
  type CarerDocumentCategory,
  type CarerDocumentFile,
  type CategoryDraft,
};
