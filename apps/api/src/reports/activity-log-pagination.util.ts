import { BadRequestException } from '@nestjs/common';
import {
  buildPaginatedReportResponse,
  parseReportPagination,
  REPORT_DEFAULT_PAGE,
  REPORT_MAX_PAGE_SIZE,
} from './report-pagination.util';
import { ACTIVITY_LOG_DEFAULT_PAGE_SIZE } from './types/activity-log.types';

export function parseActivityLogPagination(input: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; offset: number } {
  return parseReportPagination({
    page: input.page ?? REPORT_DEFAULT_PAGE,
    pageSize: input.pageSize ?? ACTIVITY_LOG_DEFAULT_PAGE_SIZE,
  });
}

export function assertActivityLogPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > REPORT_MAX_PAGE_SIZE) {
    throw new BadRequestException(
      `pageSize must be an integer between 1 and ${REPORT_MAX_PAGE_SIZE}.`,
    );
  }
}

export { buildPaginatedReportResponse };
