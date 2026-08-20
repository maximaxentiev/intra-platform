import type { StaffDocumentType } from '../../staff-documents/staff-document.constants';
import type { PaginatedReportResponse } from '../report-pagination.util';
import type {
  DocumentOverallComplianceStatus,
  DocumentReportReminderStatus,
  DocumentReportStatus,
} from '../report-document-status.util';

export const DOCUMENT_REPORT_DEFAULT_PAGE_SIZE = 25;

export interface DocumentReportReminderFields {
  latestReminderStatus: DocumentReportReminderStatus | null;
  latestReminderSentAt: string | null;
  nextReminderAt: string | null;
}

export interface DocumentReportCategoryBase {
  status: DocumentReportStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface DocumentReportVscCategory extends DocumentReportCategoryBase, DocumentReportReminderFields {
  processedDate: string | null;
  expiryDate: string | null;
}

export interface DocumentReportFirstAidCategory extends DocumentReportCategoryBase, DocumentReportReminderFields {
  expiryDate: string | null;
}

export interface DocumentReportImmunizationsCategory extends DocumentReportCategoryBase {}

export interface DocumentReportCovidCategory extends DocumentReportCategoryBase {
  optional: true;
}

export interface DocumentReportDocuments {
  vulnerableSectorCheck: DocumentReportVscCategory;
  firstAidCpr: DocumentReportFirstAidCategory;
  immunizations: DocumentReportImmunizationsCategory;
  covid19Vaccination: DocumentReportCovidCategory;
}

export interface DocumentComplianceRow {
  staffId: string;
  staffName: string;
  role: string;
  overallComplianceStatus: DocumentOverallComplianceStatus;
  documents: DocumentReportDocuments;
}

export interface DocumentComplianceSummary {
  staffShown: number;
  compliant: number;
  expiringSoon: number;
  needsAttention: number;
  pendingReview: number;
  issueFlagged: number;
  expired: number;
}

export interface DocumentComplianceResponse extends PaginatedReportResponse<DocumentComplianceRow> {
  staffIds: string[] | null;
  status: DocumentReportStatus | null;
  documentType: StaffDocumentType | null;
  summary: DocumentComplianceSummary;
}
