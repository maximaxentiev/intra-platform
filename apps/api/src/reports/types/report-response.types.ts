import type { PaginatedReportResponse } from '../report-pagination.util';

/** Authoritative minute fields — never decimal hours. */
export type ReportScheduledMinutes = number;

/** Fill rate percentage with one decimal place, or null when no fillable shifts. */
export type ReportFillRatePercent = number | null;

export type { PaginatedReportResponse };

export interface ReportDateRangeMeta {
  dateFrom: string;
  dateTo: string;
}

export interface ReportCentreFilterMeta {
  centreId?: string;
}

export interface ReportStaffFilterMeta {
  staffId?: string;
}

/** Locked fill-rate definition for shift fulfillment reports (Phase 9C). */
export interface ShiftFulfillmentRateInputs {
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
}

export interface ShiftFulfillmentSummary extends ShiftFulfillmentRateInputs {
  total: number;
  fillRatePercent: ReportFillRatePercent;
}

/** Staff usage uses scheduled minutes on completed shifts only (Phase 9D). */
export interface StaffUsageScheduledSummary {
  completedShifts: number;
  scheduledMinutesOnCompletedShifts: ReportScheduledMinutes;
}

/** Document report labels — Phase 9E. COVID optional display handled in UI layer. */
export const REPORT_OPTIONAL_DOCUMENT_TYPE_LABEL = 'Optional — Not Submitted';

export const REPORT_TOTAL_HOURS_LABEL = 'Total Hours';
export const REPORT_COMPLETED_HOURS_LABEL = 'Completed Hours';
/** @deprecated Use REPORT_COMPLETED_HOURS_LABEL */
export const REPORT_SCHEDULED_HOURS_LABEL = 'Completed Hours';
