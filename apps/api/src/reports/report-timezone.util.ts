import { TZDate } from '@date-fns/tz';
import { REPORT_TIMEZONE, parseReportDateOnly } from './report-date.util';

/**
 * UTC instant for the start of a Toronto calendar date (00:00:00 America/Toronto).
 * Used later for Activity Log timestamp boundary filtering.
 */
export function torontoDateStartInstant(date: string): Date {
  const parsed = parseReportDateOnly(date);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return new Date(new TZDate(year, month - 1, day, 0, 0, 0, REPORT_TIMEZONE).getTime());
}

/**
 * UTC instant for the start of the day after `date` in Toronto (exclusive upper bound).
 */
export function torontoDateEndExclusiveInstant(date: string): Date {
  const parsed = parseReportDateOnly(date);
  const next = new Date(parsed.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth() + 1;
  const day = next.getUTCDate();
  return new Date(new TZDate(year, month - 1, day, 0, 0, 0, REPORT_TIMEZONE).getTime());
}
