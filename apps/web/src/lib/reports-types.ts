/** Ops report filter types — used by report pages in Phase 9C+. */
export interface ReportDateRangeFilters {
  dateFrom: string;
  dateTo: string;
}

export interface ReportCentreFilter {
  centreId?: string;
}

export interface ReportStaffFilter {
  staffId?: string;
}

export interface ReportPaginationFilters {
  page?: number;
  pageSize?: number;
}

export type ReportShiftFilters = ReportDateRangeFilters & ReportCentreFilter;

export type ReportStaffUsageFilters = ReportDateRangeFilters & ReportStaffFilter;

export type ReportActivityLogFilters = ReportDateRangeFilters &
  ReportCentreFilter &
  ReportStaffFilter &
  ReportPaginationFilters;

export type ReportFillRatePercent = number | null;

export type ReportScheduledMinutes = number;
