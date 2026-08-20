import {
  REQUIRED_STAFF_DOCUMENT_TYPES,
  type StaffDocumentType,
} from '../staff-documents/staff-document.constants';
import type { StaffDocumentCategoryCompliance } from '../staff-documents/staff-document-compliance.util';

/** Per-document user-facing status for the Document Compliance report. */
export const DOCUMENT_REPORT_STATUS_VALUES = [
  'issue_flagged',
  'pending_review',
  'expired',
  'expiring_soon',
  'approved',
  'not_submitted',
] as const;

export type DocumentReportStatus = (typeof DOCUMENT_REPORT_STATUS_VALUES)[number];

export const DOCUMENT_OVERALL_COMPLIANCE_VALUES = [
  'needs_attention',
  'expiring_soon',
  'compliant',
] as const;

export type DocumentOverallComplianceStatus =
  (typeof DOCUMENT_OVERALL_COMPLIANCE_VALUES)[number];

export type DocumentReportReminderStatus = 'sent' | 'failed' | 'scheduled';

/**
 * Derive report status from authoritative compliance category state.
 * Priority: Issue Flagged → Pending Review → Expired → Expiring Soon → Approved → Not Submitted.
 */
export function deriveDocumentReportStatus(
  category: StaffDocumentCategoryCompliance,
): DocumentReportStatus {
  if (!category.isSubmitted) {
    return 'not_submitted';
  }
  if (category.reviewStatus === 'issue_flagged') {
    return 'issue_flagged';
  }
  if (category.reviewStatus === 'pending_review') {
    return 'pending_review';
  }
  if (category.expiryDisplay === 'expired') {
    return 'expired';
  }
  if (category.expiryDisplay === 'expiring_soon') {
    return 'expiring_soon';
  }
  if (category.reviewStatus === 'approved') {
    return 'approved';
  }
  return 'not_submitted';
}

/** Staff-level summary — COVID optional is ignored. */
export function deriveOverallComplianceStatus(
  categories: Map<StaffDocumentType, StaffDocumentCategoryCompliance>,
): DocumentOverallComplianceStatus {
  const statuses = REQUIRED_STAFF_DOCUMENT_TYPES.map((type) =>
    deriveDocumentReportStatus(categories.get(type)!),
  );

  if (
    statuses.some(
      (status) =>
        status === 'not_submitted' ||
        status === 'pending_review' ||
        status === 'issue_flagged' ||
        status === 'expired',
    )
  ) {
    return 'needs_attention';
  }

  if (statuses.some((status) => status === 'expiring_soon')) {
    return 'expiring_soon';
  }

  return 'compliant';
}

export function documentStatusMatchesFilter(
  docStatus: DocumentReportStatus,
  filterStatus: DocumentReportStatus,
): boolean {
  return docStatus === filterStatus;
}

/** Staff matches when ANY applicable document matches the status filter. */
export function staffMatchesDocumentStatusFilter(input: {
  documents: Record<StaffDocumentType, DocumentReportStatus>;
  filterStatus: DocumentReportStatus;
  documentType?: StaffDocumentType;
}): boolean {
  if (input.documentType) {
    return documentStatusMatchesFilter(
      input.documents[input.documentType],
      input.filterStatus,
    );
  }

  return REQUIRED_STAFF_DOCUMENT_TYPES.some((type) =>
    documentStatusMatchesFilter(input.documents[type], input.filterStatus),
  );
}

export function buildDocumentStatusMap(
  categories: Map<StaffDocumentType, StaffDocumentCategoryCompliance>,
): Record<StaffDocumentType, DocumentReportStatus> {
  return {
    vulnerable_sector_check: deriveDocumentReportStatus(
      categories.get('vulnerable_sector_check')!,
    ),
    first_aid_cpr: deriveDocumentReportStatus(categories.get('first_aid_cpr')!),
    immunizations: deriveDocumentReportStatus(categories.get('immunizations')!),
    covid19_vaccination: deriveDocumentReportStatus(
      categories.get('covid19_vaccination')!,
    ),
  };
}
