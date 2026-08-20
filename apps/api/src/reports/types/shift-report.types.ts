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
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}
