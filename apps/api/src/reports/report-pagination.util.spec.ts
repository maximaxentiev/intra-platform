import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  REPORT_DEFAULT_PAGE,
  REPORT_DEFAULT_PAGE_SIZE,
  buildPaginatedReportResponse,
  parseReportPagination,
} from './report-pagination.util';

describe('parseReportPagination', () => {
  it('defaults to page 1 and pageSize 50', () => {
    expect(parseReportPagination({})).toEqual({
      page: REPORT_DEFAULT_PAGE,
      pageSize: REPORT_DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  it('accepts boundary page sizes 1 and 100', () => {
    expect(parseReportPagination({ page: 1, pageSize: 1 }).pageSize).toBe(1);
    expect(parseReportPagination({ page: 2, pageSize: 100 }).offset).toBe(100);
  });

  it('rejects page 0', () => {
    expect(() => parseReportPagination({ page: 0 })).toThrow(BadRequestException);
  });

  it('rejects negative page', () => {
    expect(() => parseReportPagination({ page: -1 })).toThrow(BadRequestException);
  });

  it('rejects pageSize 0', () => {
    expect(() => parseReportPagination({ pageSize: 0 })).toThrow(BadRequestException);
  });

  it('rejects pageSize over 100', () => {
    expect(() => parseReportPagination({ pageSize: 101 })).toThrow(BadRequestException);
  });
});

describe('buildPaginatedReportResponse', () => {
  it('sets hasMore when additional pages exist', () => {
    expect(
      buildPaginatedReportResponse(['a'], 1, 50, 51),
    ).toEqual({
      items: ['a'],
      page: 1,
      pageSize: 50,
      totalCount: 51,
      hasMore: true,
    });
  });

  it('sets hasMore false on final page', () => {
    expect(buildPaginatedReportResponse([], 2, 50, 75).hasMore).toBe(false);
  });
});
