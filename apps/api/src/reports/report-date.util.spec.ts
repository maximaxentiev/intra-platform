import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentTorontoCalendarMonthRange,
  inclusiveCalendarDaySpan,
  lastTorontoCalendarDaysRange,
  parseReportDateOnly,
  validateReportDateRange,
} from './report-date.util';

describe('parseReportDateOnly', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(parseReportDateOnly('2026-08-01').toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rejects invalid calendar dates', () => {
    expect(() => parseReportDateOnly('2026-02-31')).toThrow(/Invalid calendar date/);
  });

  it('rejects non-ISO formats', () => {
    expect(() => parseReportDateOnly('08/19/2026')).toThrow(/expected YYYY-MM-DD/);
  });
});

describe('validateReportDateRange', () => {
  it('accepts a valid month range', () => {
    expect(() => validateReportDateRange('2026-08-01', '2026-08-31')).not.toThrow();
  });

  it('accepts same-day range', () => {
    expect(() => validateReportDateRange('2026-08-19', '2026-08-19')).not.toThrow();
    expect(inclusiveCalendarDaySpan('2026-08-19', '2026-08-19')).toBe(1);
  });

  it('rejects reverse ranges', () => {
    expect(() => validateReportDateRange('2026-09-01', '2026-08-01')).toThrow(/on or before/);
  });

  it('allows exactly 366 inclusive calendar days', () => {
    expect(() => validateReportDateRange('2025-01-01', '2025-12-31')).not.toThrow();
    expect(inclusiveCalendarDaySpan('2025-01-01', '2025-12-31')).toBe(365);
    expect(() => validateReportDateRange('2024-01-01', '2024-12-31')).not.toThrow();
    expect(inclusiveCalendarDaySpan('2024-01-01', '2024-12-31')).toBe(366);
  });

  it('rejects spans over 366 inclusive days', () => {
    expect(() => validateReportDateRange('2024-01-01', '2025-01-01')).toThrow(/366/);
  });
});

describe('currentTorontoCalendarMonthRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the Toronto calendar month for a normal date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T16:00:00.000Z'));
    expect(currentTorontoCalendarMonthRange()).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('uses Toronto date when UTC is already the next month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T04:00:00.000Z'));
    expect(currentTorontoCalendarMonthRange()).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
  });

  it('handles year rollover in Toronto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T04:30:00.000Z'));
    expect(currentTorontoCalendarMonthRange()).toEqual({
      dateFrom: '2025-12-01',
      dateTo: '2025-12-31',
    });
  });

  it('uses Toronto previous calendar date near UTC midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T03:30:00.000Z'));
    expect(currentTorontoCalendarMonthRange()).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('handles DST season consistently', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T06:00:00.000Z'));
    expect(currentTorontoCalendarMonthRange()).toEqual({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });
  });
});

describe('lastTorontoCalendarDaysRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 30 inclusive Toronto calendar days ending today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T16:00:00.000Z'));
    const range = lastTorontoCalendarDaysRange(30);
    expect(range.dateTo).toBe('2026-08-19');
    expect(range.dateFrom).toBe('2026-07-21');
    expect(inclusiveCalendarDaySpan(range.dateFrom, range.dateTo)).toBe(30);
  });
});
