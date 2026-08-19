import { StaffDocumentValidationError } from './staff-document-validation.util';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse YYYY-MM-DD as UTC calendar date (no time component). */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_RE.test(value)) {
    throw new StaffDocumentValidationError(`Invalid date "${value}" — expected YYYY-MM-DD.`);
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new StaffDocumentValidationError(`Invalid calendar date "${value}".`);
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add whole calendar years; Feb 29 in a leap year becomes Feb 28 in non-leap years. */
export function addCalendarYears(date: Date, years: number): Date {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const result = new Date(Date.UTC(y, m, d));
  if (result.getUTCMonth() !== m) {
    return new Date(Date.UTC(y, m + 1, 0));
  }
  return result;
}

/** VSC expiry = processed date + exactly 1 calendar year (annual renewal). */
export function deriveVscExpiryDate(processedDate: string): string {
  const parsed = parseDateOnly(processedDate);
  return formatDateOnly(addCalendarYears(parsed, 1));
}

export function assertProcessedDateNotInFuture(
  processedDate: string,
  today: Date = startOfUtcDay(new Date()),
): void {
  const parsed = parseDateOnly(processedDate);
  if (parsed.getTime() > today.getTime()) {
    throw new StaffDocumentValidationError('Processed date cannot be in the future.');
  }
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export type StaffDocumentExpiryDisplay = 'no_expiry' | 'current' | 'expiring_soon' | 'expired';

export const STAFF_DOCUMENT_EXPIRING_SOON_DAYS = 30;

/**
 * Derived expiry display — never stored in DB.
 * expiring_soon: today <= expiry <= today + 30 days (inclusive).
 */
export function deriveExpiryDisplay(
  expiryDate: string | null | undefined,
  today: Date = startOfUtcDay(new Date()),
): StaffDocumentExpiryDisplay {
  if (!expiryDate) return 'no_expiry';

  const expiry = parseDateOnly(expiryDate);
  const todayMs = today.getTime();
  const expiryMs = expiry.getTime();

  if (expiryMs < todayMs) return 'expired';

  const soonEnd = addCalendarDays(today, STAFF_DOCUMENT_EXPIRING_SOON_DAYS);
  if (expiryMs <= soonEnd.getTime()) return 'expiring_soon';

  return 'current';
}
