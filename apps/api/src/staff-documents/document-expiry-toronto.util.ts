import { TZDate } from '@date-fns/tz';
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
