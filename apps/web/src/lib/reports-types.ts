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
