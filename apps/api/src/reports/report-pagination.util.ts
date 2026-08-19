import { BadRequestException } from '@nestjs/common';

export const REPORT_DEFAULT_PAGE = 1;
export const REPORT_DEFAULT_PAGE_SIZE = 50;
export const REPORT_MAX_PAGE_SIZE = 100;

export interface ReportPaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginatedReportResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export function parseReportPagination(input: ReportPaginationInput): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = input.page ?? REPORT_DEFAULT_PAGE;
  const pageSize = input.pageSize ?? REPORT_DEFAULT_PAGE_SIZE;

  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException('page must be an integer >= 1.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > REPORT_MAX_PAGE_SIZE) {
    throw new BadRequestException(`pageSize must be an integer between 1 and ${REPORT_MAX_PAGE_SIZE}.`);
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPaginatedReportResponse<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalCount: number,
): PaginatedReportResponse<T> {
  return {
    items,
    page,
    pageSize,
    totalCount,
    hasMore: page * pageSize < totalCount,
  };
}
