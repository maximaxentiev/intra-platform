import { AVAILABILITY_TIMEZONE } from '../availability/availability-toronto.util';

/** Ops report calendar semantics — America/Toronto. */
export const REPORT_TIMEZONE = AVAILABILITY_TIMEZONE;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportDateValidationError';
  }
}

/** Parse YYYY-MM-DD as a UTC calendar date (no locale parsing). */
export function parseReportDateOnly(value: string): Date {
  if (!DATE_ONLY_RE.test(value)) {
    throw new ReportDateValidationError(`Invalid date "${value}" — expected YYYY-MM-DD.`);
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new ReportDateValidationError(`Invalid calendar date "${value}".`);
  }
  return date;
}

export function formatReportDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function compareReportDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Inclusive calendar-day count between two YYYY-MM-DD values. */
export function inclusiveCalendarDaySpan(dateFrom: string, dateTo: string): number {
  const from = parseReportDateOnly(dateFrom);
  const to = parseReportDateOnly(dateTo);
  const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays + 1;
}

export const REPORT_MAX_INCLUSIVE_DATE_SPAN_DAYS = 366;

export function validateReportDateRange(dateFrom: string, dateTo: string): void {
  parseReportDateOnly(dateFrom);
  parseReportDateOnly(dateTo);
  if (compareReportDateStrings(dateFrom, dateTo) > 0) {
    throw new ReportDateValidationError('dateFrom must be on or before dateTo.');
  }
  const span = inclusiveCalendarDaySpan(dateFrom, dateTo);
  if (span > REPORT_MAX_INCLUSIVE_DATE_SPAN_DAYS) {
    throw new ReportDateValidationError(
      `Date range must not exceed ${REPORT_MAX_INCLUSIVE_DATE_SPAN_DAYS} inclusive calendar days.`,
    );
  }
}

export function torontoTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function torontoCalendarParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addReportCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** First and last Toronto calendar dates for the current month containing `now`. */
export function currentTorontoCalendarMonthRange(now: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const { year, month } = torontoCalendarParts(now);
  const monthStr = String(month).padStart(2, '0');
  const lastDay = daysInCalendarMonth(year, month);
  return {
    dateFrom: `${year}-${monthStr}-01`,
    dateTo: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Inclusive Toronto calendar range ending on today's Toronto date.
 * `days = 30` → today plus the previous 29 calendar days.
 */
export function lastTorontoCalendarDaysRange(
  days: number,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  if (!Number.isInteger(days) || days < 1) {
    throw new ReportDateValidationError('days must be a positive integer.');
  }
  const dateTo = torontoTodayDateString(now);
  const end = parseReportDateOnly(dateTo);
  const start = addReportCalendarDays(end, -(days - 1));
  return {
    dateFrom: formatReportDateOnly(start),
    dateTo,
  };
}

/**
 * Resolve report date bounds. When omitted, defaults to the current Toronto calendar month.
 * When partially provided, throws — both must be supplied together.
 */
export function resolveReportDateRange(dateFrom?: string, dateTo?: string): {
  dateFrom: string;
  dateTo: string;
} {
  if (dateFrom === undefined && dateTo === undefined) {
    return currentTorontoCalendarMonthRange();
  }
  if (dateFrom === undefined || dateTo === undefined) {
    throw new ReportDateValidationError('dateFrom and dateTo must both be provided.');
  }
  validateReportDateRange(dateFrom, dateTo);
  return { dateFrom, dateTo };
}

/** Shift report filter: inclusive bounds on shifts.shift_date. */
export function shiftDateWithinReportRange(
  shiftDateColumn: string,
  dateFrom: string,
  dateTo: string,
): { sql: string; params: { dateFrom: string; dateTo: string } } {
  validateReportDateRange(dateFrom, dateTo);
  return {
    sql: `${shiftDateColumn} >= :dateFrom AND ${shiftDateColumn} <= :dateTo`,
    params: { dateFrom, dateTo },
  };
}
