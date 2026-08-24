import { TZDate } from '@date-fns/tz';
import { subMonths } from 'date-fns';
import { AVAILABILITY_TIMEZONE } from '../availability/availability-toronto.util';
import { parseDateOnly } from './staff-document-dates.util';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function subtractCalendarDaysFromDateOnly(expiryDate: string, offsetDays: number): {
  year: number;
  month: number;
  day: number;
} {
  const parsed = parseDateOnly(expiryDate);
  const reminder = new Date(parsed.getTime());
  reminder.setUTCDate(reminder.getUTCDate() - offsetDays);
  return {
    year: reminder.getUTCFullYear(),
    month: reminder.getUTCMonth() + 1,
    day: reminder.getUTCDate(),
  };
}

/** Calendar-month subtraction using date-fns subMonths on UTC date components. */
export function subtractCalendarMonthsFromDateOnly(
  expiryDate: string,
  offsetMonths: number,
): {
  year: number;
  month: number;
  day: number;
} {
  const parsed = parseDateOnly(expiryDate);
  const anchor = new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const reminder = subMonths(anchor, offsetMonths);
  return {
    year: reminder.getFullYear(),
    month: reminder.getMonth() + 1,
    day: reminder.getDate(),
  };
}

/**
 * Absolute UTC instant for a document expiry reminder at 09:00 America/Toronto
 * on (expiry calendar date − offsetDays).
 */
export function torontoDocumentReminderInstant(
  expiryDate: string,
  offsetDays: number,
  hour = 9,
): Date {
  if (!DATE_ONLY_RE.test(expiryDate.trim())) {
    throw new Error(`Invalid expiry date "${expiryDate}".`);
  }
  const { year, month, day } = subtractCalendarDaysFromDateOnly(expiryDate, offsetDays);
  const toronto = new TZDate(year, month - 1, day, hour, 0, 0, AVAILABILITY_TIMEZONE);
  return new Date(toronto.getTime());
}

/**
 * Absolute UTC instant for a document expiry reminder at 09:00 America/Toronto
 * on (expiry calendar date − offsetMonths calendar months).
 */
export function torontoDocumentReminderInstantMonths(
  expiryDate: string,
  offsetMonths: number,
  hour = 9,
): Date {
  if (!DATE_ONLY_RE.test(expiryDate.trim())) {
    throw new Error(`Invalid expiry date "${expiryDate}".`);
  }
  const { year, month, day } = subtractCalendarMonthsFromDateOnly(expiryDate, offsetMonths);
  const toronto = new TZDate(year, month - 1, day, hour, 0, 0, AVAILABILITY_TIMEZONE);
  return new Date(toronto.getTime());
}

