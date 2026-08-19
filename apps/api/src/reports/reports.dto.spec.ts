import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ReportRequiredDateRangeQueryDto } from './dto/report-date-range.dto';
import { ReportPaginationQueryDto } from './dto/report-pagination.dto';

describe('ReportRequiredDateRangeQueryDto', () => {
  it('accepts valid ranges', async () => {
    const dto = new ReportRequiredDateRangeQueryDto();
    dto.dateFrom = '2026-08-01';
    dto.dateTo = '2026-08-31';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid date format', async () => {
    const dto = new ReportRequiredDateRangeQueryDto();
    dto.dateFrom = '08/19/2026';
    dto.dateTo = '2026-08-31';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid calendar date', async () => {
    const dto = new ReportRequiredDateRangeQueryDto();
    dto.dateFrom = '2026-02-31';
    dto.dateTo = '2026-08-31';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ReportPaginationQueryDto', () => {
  it('accepts default pagination values', async () => {
    const dto = new ReportPaginationQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects pageSize over 100', async () => {
    const dto = new ReportPaginationQueryDto();
    dto.pageSize = 101;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
