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
