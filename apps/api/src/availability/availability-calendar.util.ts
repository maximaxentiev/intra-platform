import { parseCalendarDateString } from './availability-toronto.util';

/** Monday-based day index used by availability: 0=Mon .. 6=Sun. */
export function calendarDateFromWeekDay(weekStartDate: string, dayOfWeek: number): string {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(`Invalid dayOfWeek "${dayOfWeek}".`);
  }
  const { year, month, day } = parseCalendarDateString(weekStartDate);
  const probe = new Date(Date.UTC(year, month - 1, day + dayOfWeek));
  const y = probe.getUTCFullYear();
  const m = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const d = String(probe.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when the date string is a Monday (calendar math, timezone-agnostic). */
export function isMondayDateString(dateStr: string): boolean {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCDay() === 1;
}
