import type { DocumentOverallComplianceStatus, DocumentReportStatus } from './report-document-status.util';
import { REPORT_OPTIONAL_DOCUMENT_TYPE_LABEL } from './types/report-response.types';

export const DOCUMENT_REPORT_STATUS_CSV_LABELS: Record<DocumentReportStatus, string> = {
  not_submitted: 'Not Submitted',
  pending_review: 'Pending Review',
  approved: 'Approved',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  issue_flagged: 'Issue Flagged',
};

export const DOCUMENT_OVERALL_CSV_LABELS: Record<DocumentOverallComplianceStatus, string> = {
  compliant: 'Compliant',
  expiring_soon: 'Expiring Soon',
  needs_attention: 'Needs Attention',
};

export function documentStatusCsvLabel(
  status: DocumentReportStatus,
  optional?: boolean,
): string {
  if (optional && status === 'not_submitted') {
    return REPORT_OPTIONAL_DOCUMENT_TYPE_LABEL.replace('—', '-');
  }
  return DOCUMENT_REPORT_STATUS_CSV_LABELS[status];
}

export function reminderStatusCsvLabel(
  status: 'sent' | 'failed' | 'scheduled' | null | undefined,
): string {
  if (!status) return '';
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Failed';
  if (status === 'scheduled') return 'Scheduled';
  return '';
}

export function activityCategoryCsvLabel(category: string): string {
  const labels: Record<string, string> = {
    shifts: 'Shifts',
    centres: 'Centres',
    staff: 'Staff',
    users: 'Users',
    documents: 'Documents',
    communications: 'Communications',
    system: 'System',
  };
  return labels[category] ?? category;
}
