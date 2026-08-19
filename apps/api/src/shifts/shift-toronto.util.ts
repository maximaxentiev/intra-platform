import { TZDate } from '@date-fns/tz';
import { AVAILABILITY_TIMEZONE } from '../availability/availability-toronto.util';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})$/;

/** Canonical schedule version token for reminder idempotency (no colons). */
export function deriveShiftScheduleVersion(shiftDate: string, startTime: string): string {
  const date = shiftDate.trim();
  const time = normalizeWallClockTime(startTime);
  return `${date}_${time.replace(/:/g, '-')}`;
}

export function normalizeWallClockTime(time: string): string {
  const trimmed = time.trim();
  const match = TIME_RE.exec(trimmed);
  if (match) return `${match[1]}:${match[2]}:${match[3]}`;
  const short = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (short) return `${short[1]}:${short[2]}:00`;
  throw new Error(`Invalid wall-clock time "${time}".`);
}

/**
 * Absolute UTC instant for a Toronto wall-clock shift start.
 * shiftDate: YYYY-MM-DD, startTime: HH:mm:ss
 */
export function torontoShiftStartInstant(shiftDate: string, startTime: string): Date {
  const dateMatch = DATE_RE.exec(shiftDate.trim());
  if (!dateMatch) throw new Error(`Invalid shift date "${shiftDate}".`);
  const time = normalizeWallClockTime(startTime);
  const [hour, minute, second] = time.split(':').map(Number);
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const toronto = new TZDate(year, month - 1, day, hour, minute, second, AVAILABILITY_TIMEZONE);
  return new Date(toronto.getTime());
}

/**
 * Absolute UTC instant for a Toronto wall-clock shift end (same calendar date as shiftDate).
 */
export function torontoShiftEndInstant(shiftDate: string, endTime: string): Date {
  return torontoShiftStartInstant(shiftDate, endTime);
}

export function addMillisecondsToDate(instant: Date, ms: number): Date {
  return new Date(instant.getTime() + ms);
}
