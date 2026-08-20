/** Ops report API response types (Phase 9C+). */

export type ReportFillRatePercent = number | null;

export interface ShiftFulfillmentSummary {
  total: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
}

export interface ShiftFulfillmentResponse {
  dateFrom: string;
  dateTo: string;
  centreId: string | null;
  centreName: string | null;
  summary: ShiftFulfillmentSummary;
}

export interface CentreUsageRow {
  centreId: string;
  centreName: string;
  totalShifts: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
  totalScheduledMinutes: number;
  completedScheduledMinutes: number;
}

export interface CentreUsageSummary {
  totalCentres: number;
  totalShifts: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
  totalScheduledMinutes: number;
  totalCompletedScheduledMinutes: number;
}

export interface CentreUsageResponse {
  dateFrom: string;
  dateTo: string;
  centreIds: string[] | null;
  summary: CentreUsageSummary;
  rows: CentreUsageRow[];
}

export const REPORT_SCHEDULED_HOURS_LABEL = "Scheduled Hours on Completed Shifts";
export const REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL =
  "Scheduled Hours on Filled Shifts";

export interface StaffUsageRow {
  staffId: string;
  staffName: string;
  role: string;
  completedShifts: number;
  completedScheduledMinutes: number;
  filledShifts: number;
  filledScheduledMinutes: number;
}

export interface StaffUsageSummary {
  totalStaff: number;
  completedShifts: number;
  completedScheduledMinutes: number;
  filledShifts: number;
  filledScheduledMinutes: number;
}

export interface StaffUsageResponse {
  dateFrom: string;
  dateTo: string;
  staffIds: string[] | null;
  summary: StaffUsageSummary;
  rows: StaffUsageRow[];
}

export interface StaffUsageShiftRow {
  shiftId: string;
  shiftDate: string;
  centreName: string;
  role: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  scheduledMinutes: number;
}

export interface StaffUsageShiftsResponse {
  dateFrom: string;
  dateTo: string;
  staffId: string;
  items: StaffUsageShiftRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

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

export interface DocumentComplianceResponse {
  staffIds: string[] | null;
  status: DocumentReportStatus | null;
  documentType: string | null;
  summary: DocumentComplianceSummary;
  items: DocumentComplianceRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export type ActivityLogCategory =
  | "shifts"
  | "staff"
  | "documents"
  | "communications"
  | "centres"
  | "users"
  | "system";

export type ActivityLogActorType = "ops_user" | "staff" | "system" | "unknown";

export interface ActivityLogActor {
  type: ActivityLogActorType;
  id: string | null;
  name: string | null;
}

export interface ActivityLogItem {
  id: string;
  occurredAt: string;
  category: ActivityLogCategory;
  action: string;
  title: string;
  description: string | null;
  actor: ActivityLogActor;
  staff?: { id: string; name: string };
  centre?: { id: string; name: string };
  shift?: { id: string; shiftDate: string };
  metadata?: Record<string, unknown>;
}

export interface ActivityLogResponse {
  dateFrom: string;
  dateTo: string;
  category: ActivityLogCategory | null;
  actorType: ActivityLogActorType | null;
  staffId: string | null;
  centreId: string | null;
  shiftId: string | null;
  items: ActivityLogItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}
