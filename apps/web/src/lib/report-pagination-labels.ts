export const STAFF_USAGE_SHIFT_DETAIL_DEFAULT_PAGE_SIZE = 10;

export const STAFF_USAGE_SHIFT_DETAIL_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type StaffUsageShiftDetailPageSize =
  (typeof STAFF_USAGE_SHIFT_DETAIL_PAGE_SIZE_OPTIONS)[number];

export function resolveStaffUsageShiftDetailPageSize(value?: number): StaffUsageShiftDetailPageSize {
  if (
    value !== undefined &&
    (STAFF_USAGE_SHIFT_DETAIL_PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  ) {
    return value as StaffUsageShiftDetailPageSize;
  }
  return STAFF_USAGE_SHIFT_DETAIL_DEFAULT_PAGE_SIZE;
}

export const REPORT_COMPARISON_DEFAULT_PAGE_SIZE = 10;

export const REPORT_COMPARISON_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type ReportComparisonPageSize = (typeof REPORT_COMPARISON_PAGE_SIZE_OPTIONS)[number];

export function isReportComparisonPageSize(value: number): value is ReportComparisonPageSize {
  return (REPORT_COMPARISON_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function resolveReportComparisonPageSize(value?: number): ReportComparisonPageSize {
  if (value !== undefined && isReportComparisonPageSize(value)) return value;
  return REPORT_COMPARISON_DEFAULT_PAGE_SIZE;
}

export function reportResultRange(input: {
  page: number;
  pageSize: number;
  totalCount: number;
}): { start: number; end: number; totalPages: number } {
  const totalPages = input.totalCount === 0 ? 0 : Math.ceil(input.totalCount / input.pageSize);
  if (input.totalCount === 0) {
    return { start: 0, end: 0, totalPages: 0 };
  }
  const start = (input.page - 1) * input.pageSize + 1;
  const end = Math.min(input.page * input.pageSize, input.totalCount);
  return { start, end, totalPages };
}

export function reportPaginationRangeLabel(input: {
  page: number;
  pageSize: number;
  totalCount: number;
  entityLabel: string;
  emptyLabel?: string;
}): string {
  const { start, end } = reportResultRange(input);
  if (input.totalCount === 0) {
    return input.emptyLabel ?? `0 ${input.entityLabel}`;
  }
  return `Showing ${start}–${end} of ${input.totalCount} ${input.entityLabel}`;
}
