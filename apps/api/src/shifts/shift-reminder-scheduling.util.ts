import {
  addMillisecondsToDate,
  torontoShiftStartInstant,
} from './shift-toronto.util';
import {
  SHIFT_REMINDER_INTERVALS,
  SHIFT_REMINDER_OFFSET_MS,
  type ShiftReminderInterval,
} from './shift-reminder.types';

export type FutureShiftReminderPlan = {
  interval: ShiftReminderInterval;
  scheduledFor: Date;
};

/** Future reminder intervals only — past-due intervals are omitted entirely. */
export function planFutureShiftReminders(
  shiftDate: string,
  startTime: string,
  now: Date = new Date(),
): FutureShiftReminderPlan[] {
  const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
  const plans: FutureShiftReminderPlan[] = [];

  for (const interval of SHIFT_REMINDER_INTERVALS) {
    const scheduledFor = addMillisecondsToDate(shiftStart, -SHIFT_REMINDER_OFFSET_MS[interval]);
    if (scheduledFor.getTime() > now.getTime()) {
      plans.push({ interval, scheduledFor });
    }
  }

  return plans;
}

export function reminderIntervalMatchesShiftStart(
  interval: ShiftReminderInterval,
  shiftDate: string,
  startTime: string,
): boolean {
  const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
  const expected = addMillisecondsToDate(shiftStart, -SHIFT_REMINDER_OFFSET_MS[interval]);
  return Number.isFinite(expected.getTime());
}
