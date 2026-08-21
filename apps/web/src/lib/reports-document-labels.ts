/** Document Compliance report labels and display helpers. */

export type DocumentReportStatus =
  | "issue_flagged"
  | "pending_review"
  | "expired"
  | "expiring_soon"
  | "approved"
  | "not_submitted";

export type DocumentOverallComplianceStatus =
  | "needs_attention"
  | "expiring_soon"
  | "compliant";

export type DocumentReportReminderStatus = "sent" | "failed" | "scheduled";

export const DOCUMENT_REPORT_STATUS_LABELS: Record<DocumentReportStatus, string> = {
  issue_flagged: "Issue Flagged",
  pending_review: "Pending Review",
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  approved: "Approved",
  not_submitted: "Not Submitted",
};

export const DOCUMENT_OVERALL_STATUS_LABELS: Record<DocumentOverallComplianceStatus, string> = {
  needs_attention: "Needs Attention",
  expiring_soon: "Expiring Soon",
  compliant: "Compliant",
};

export const DOCUMENT_TYPE_FILTER_OPTIONS = [
  { value: "vulnerable_sector_check", label: "Vulnerable Sector Check" },
  { value: "first_aid_cpr", label: "First Aid & CPR" },
  { value: "immunizations", label: "Immunizations" },
  { value: "covid19_vaccination", label: "COVID-19 Vaccination" },
] as const;

export const DOCUMENT_STATUS_FILTER_OPTIONS = [
  { value: "not_submitted", label: "Not Submitted" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "issue_flagged", label: "Issue Flagged" },
] as const;

export const REPORT_OPTIONAL_DOCUMENT_TYPE_LABEL = "Optional — Not Submitted";

export function documentReportStatusLabel(
  status: DocumentReportStatus,
  optional?: boolean,
): string {
  if (optional && status === "not_submitted") {
    return REPORT_OPTIONAL_DOCUMENT_TYPE_LABEL;
  }
  return DOCUMENT_REPORT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function documentReminderStatusLabel(status: DocumentReportReminderStatus | null): string {
  if (!status) return "—";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "scheduled") return "Scheduled";
  return status;
}

export function documentCategoryShortLabel(key: DocumentReportDocumentsKeys): string {
  switch (key) {
    case "vulnerableSectorCheck":
      return "VSC";
    case "firstAidCpr":
      return "First Aid";
    case "immunizations":
      return "Immunizations";
    case "covid19Vaccination":
      return "COVID";
    default:
      return key;
  }
}

export type DocumentReportDocumentsKeys =
  | "vulnerableSectorCheck"
  | "firstAidCpr"
  | "immunizations"
  | "covid19Vaccination";

export const DOCUMENT_MATRIX_COLUMNS: {
  key: DocumentReportDocumentsKeys;
  label: string;
}[] = [
  { key: "vulnerableSectorCheck", label: "VSC" },
  { key: "firstAidCpr", label: "First Aid & CPR" },
  { key: "immunizations", label: "Immunizations" },
  { key: "covid19Vaccination", label: "COVID" },
];
