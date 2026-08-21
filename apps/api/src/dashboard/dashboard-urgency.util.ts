import { addMillisecondsToDate, torontoShiftStartInstant } from '../shifts/shift-toronto.util';
import {
  isShiftDateOnOrAfterToday,
  URGENT_PENDING_WINDOW_MS,
} from './dashboard-date.util';

export function urgentPendingCutoffInstant(now: Date = new Date()): Date {
  return addMillisecondsToDate(now, URGENT_PENDING_WINDOW_MS);
}

/**
 * Urgent pending shift:
 * - status must already be pending (caller filters)
 * - shift_date is not before Toronto today
 * - Toronto start datetime <= now + 24 hours
 */
export function isUrgentPendingShift(
  shift: { shiftDate: string; startTime: string },
  today: string,
  now: Date = new Date(),
): boolean {
  if (!isShiftDateOnOrAfterToday(shift.shiftDate, today)) {
    return false;
  }
  const start = torontoShiftStartInstant(shift.shiftDate, shift.startTime);
  return start.getTime() <= urgentPendingCutoffInstant(now).getTime();
}

/** Minutes from `now` until Toronto shift start (negative when start is in the past). */
export function minutesUntilShiftStart(
  shiftDate: string,
  startTime: string,
  now: Date = new Date(),
): number {
  const start = torontoShiftStartInstant(shiftDate, startTime);
  return Math.round((start.getTime() - now.getTime()) / 60_000);
}

export function torontoShiftStartIso(shiftDate: string, startTime: string): string {
  return torontoShiftStartInstant(shiftDate, startTime).toISOString();
}
