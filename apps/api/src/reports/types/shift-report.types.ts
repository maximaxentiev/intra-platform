import type { ReportFillRatePercent } from './report-response.types';

export interface ShiftFulfillmentSummary {
  totalCentres: number;
  totalShifts: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
}

export interface ShiftFulfillmentRow {
  centreId: string;
  centreName: string;
  totalShifts: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
}

export interface ShiftFulfillmentResponse {
  dateFrom: string;
  dateTo: string;
  centreIds: string[] | null;
  centreId: string | null;
  centreName: string | null;
  summary: ShiftFulfillmentSummary;
  rows: ShiftFulfillmentRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
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
  cancelledScheduledMinutes: number;
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
  cancelledScheduledMinutes: number;
}

export interface CentreUsageResponse {
  dateFrom: string;
  dateTo: string;
  centreIds: string[] | null;
  summary: CentreUsageSummary;
  rows: CentreUsageRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export type CentreUsageShiftRowStatus = 'pending' | 'filled' | 'completed' | 'cancelled';

export interface CentreUsageShiftRow {
  shiftId: string;
  shiftDate: string;
  centreId: string;
  centreName: string;
  staffId: string | null;
  staffName: string;
  role: string;
  status: CentreUsageShiftRowStatus;
  startTime: string;
  endTime: string;
  scheduledMinutes: number;
}

export interface CentreUsageShiftsSummary {
  totalShifts: number;
  totalScheduledMinutes: number;
  uniqueStaff: number;
}

export interface CentreUsageShiftsResponse {
  dateFrom: string;
  dateTo: string;
  centreIds: string[];
  status: string;
  staffIds: string[] | null;
  summary: CentreUsageShiftsSummary;
  rows: CentreUsageShiftRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}
