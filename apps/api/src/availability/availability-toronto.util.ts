/** Ontario workplace timezone for availability calendar semantics. */
export const AVAILABILITY_TIMEZONE = 'America/Toronto';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in America/Toronto as YYYY-MM-DD. */
export function torontoTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AVAILABILITY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Compare YYYY-MM-DD strings (-1 / 0 / 1). */
export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isDateBeforeTodayInToronto(calendarDate: string, today = torontoTodayDateString()): boolean {
  return compareDateStrings(calendarDate, today) < 0;
}

/** Current wall-clock time in America/Toronto as HH:mm:ss (24h). */
export function torontoNowTimeString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AVAILABILITY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = parts.find((p) => p.type === 'second')?.value ?? '00';
  return `${hour}:${minute}:${second}`;
}

export function parseCalendarDateString(value: string): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarParts(year, month, day)) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  return { year, month, day };
}

function isValidCalendarParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}
