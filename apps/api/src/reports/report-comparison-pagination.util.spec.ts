import { describe, expect, it } from 'vitest';
import { paginateReportRows } from './report-comparison-pagination.util';

describe('paginateReportRows', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));

  it('normalizes page beyond last page to the last valid page', () => {
    const result = paginateReportRows(rows, 9, 50);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(12);
    expect(result.totalCount).toBe(12);
    expect(result.hasMore).toBe(false);
  });

  it('normalizes high page number when page size is smaller', () => {
    const result = paginateReportRows(rows, 9, 10);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(12);
    expect(result.hasMore).toBe(false);
  });

  it('returns page 1 with empty items when no rows match', () => {
    const result = paginateReportRows([], 5, 10);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
