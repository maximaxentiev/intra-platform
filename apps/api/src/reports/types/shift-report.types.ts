import type { ReportFillRatePercent } from './report-response.types';

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
  totalScheduledMinutes: number;
  totalCompletedScheduledMinutes: number;
}

export interface CentreUsageResponse {
  dateFrom: string;
  dateTo: string;
  centreId: string | null;
  summary: CentreUsageSummary;
  rows: CentreUsageRow[];
}
