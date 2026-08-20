import { describe, expect, it } from 'vitest';
import { parseActivityLogPagination } from './activity-log-pagination.util';
import { ACTIVITY_LOG_DEFAULT_PAGE_SIZE } from './types/activity-log.types';

describe('parseActivityLogPagination', () => {
  it('defaults to page 1 and pageSize 10', () => {
    expect(parseActivityLogPagination({})).toEqual({
      page: 1,
      pageSize: ACTIVITY_LOG_DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  it('accepts pageSize 10, 25, and 50', () => {
    expect(parseActivityLogPagination({ pageSize: 10 }).pageSize).toBe(10);
    expect(parseActivityLogPagination({ pageSize: 25 }).pageSize).toBe(25);
    expect(parseActivityLogPagination({ pageSize: 50 }).pageSize).toBe(50);
  });

  it('computes offset for page 2 with pageSize 10', () => {
    expect(parseActivityLogPagination({ page: 2, pageSize: 10 })).toEqual({
      page: 2,
      pageSize: 10,
      offset: 10,
    });
  });
});
