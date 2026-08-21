import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { REPORT_TIMEZONE } from './report-date.util';

const FORMULA_PREFIX = /^[=+\-@]/;

/** Escape and sanitize a CSV text cell (formula-injection safe). */
export function csvTextCell(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Numeric CSV cell — no formula sanitization needed for plain numbers. */
export function csvNumberCell(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(value);
}

export function minutesToCsvHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(csvTextCell).join(',');
  const body = rows.map((row) => row.join(',')).join('\r\n');
  return `\uFEFF${headerLine}\r\n${body}`;
}

export function reportCsvFilename(prefix: string, dateFrom?: string, dateTo?: string): string {
  if (dateFrom && dateTo) {
    return `${prefix}-${dateFrom}-to-${dateTo}.csv`;
  }
  const today = format(new TZDate(new Date(), REPORT_TIMEZONE), 'yyyy-MM-dd');
  return `${prefix}-${today}.csv`;
}

/** Human-readable Toronto timestamp for CSV (YYYY-MM-DD HH:mm:ss). */
export function formatTorontoTimestampForCsv(isoOrDate: string | Date): string {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';
  return format(new TZDate(date, REPORT_TIMEZONE), 'yyyy-MM-dd HH:mm:ss');
}

export function formatCsvDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** Time portion for CSV (HH:mm from stored time). */
export function formatCsvTimeOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}
