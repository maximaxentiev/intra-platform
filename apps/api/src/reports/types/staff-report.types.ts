import type { PaginatedReportResponse } from '../report-pagination.util';

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
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
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

export type StaffUsageShiftsResponse = PaginatedReportResponse<StaffUsageShiftRow> & {
  dateFrom: string;
  dateTo: string;
  staffId: string;
};
