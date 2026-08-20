import {
  buildPaginatedReportResponse,
  parseReportPagination,
  REPORT_DEFAULT_PAGE,
} from './report-pagination.util';

/** Default page size for centre/staff comparison reports (Phase 9 UX pass). */
export const REPORT_COMPARISON_DEFAULT_PAGE_SIZE = 10;

export const REPORT_COMPARISON_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type ReportComparisonPageSize = (typeof REPORT_COMPARISON_PAGE_SIZE_OPTIONS)[number];

export function parseComparisonReportPagination(input: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; offset: number } {
  return parseReportPagination({
    page: input.page ?? REPORT_DEFAULT_PAGE,
    pageSize: input.pageSize ?? REPORT_COMPARISON_DEFAULT_PAGE_SIZE,
  });
}

export function paginateReportRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; totalCount: number; page: number; pageSize: number; hasMore: boolean } {
  const totalCount = rows.length;
  const offset = (page - 1) * pageSize;
  const items = rows.slice(offset, offset + pageSize);
  return {
    ...buildPaginatedReportResponse(items, page, pageSize, totalCount),
  };
}

export { buildPaginatedReportResponse };
