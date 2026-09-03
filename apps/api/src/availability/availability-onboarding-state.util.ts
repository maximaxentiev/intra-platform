import { calendarDateFromWeekDay } from './availability-calendar.util';
import {
  compareDateStrings,
  parseCalendarDateString,
  torontoTodayDateString,
} from './availability-toronto.util';

export type OnboardingDayStatus = 'exempt_past' | 'incomplete' | 'available' | 'unavailable';

export type AnchoredOnboardingDay = {
  calendarDate: string;
  weekIndex: 1 | 2;
  dayOfWeek: number;
  weekStartDate: string;
};

export type OnboardingDayWindow = {
  id: string;
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
};

/** Monday of the calendar week containing `dateStr` (UTC calendar math). */
export function mondayOfDateString(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const jsDay = probe.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(Date.UTC(year, month - 1, day + diff));
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day + days));
  const y = probe.getUTCFullYear();
  const m = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const d = String(probe.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function torontoMondayWeekStart(today = torontoTodayDateString()): string {
  return mondayOfDateString(today);
}

/** Availability week coordinates for a calendar date (Mon=0 .. Sun=6). */
export function weekDayFromCalendarDate(calendarDate: string): {
  weekStartDate: string;
  dayOfWeek: number;
} {
  const weekStartDate = mondayOfDateString(calendarDate);
  const start = parseCalendarDateString(weekStartDate);
  const current = parseCalendarDateString(calendarDate);
  const dayOfWeek = Math.round(
    (Date.UTC(current.year, current.month - 1, current.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      (24 * 60 * 60 * 1000),
  );
  return { weekStartDate, dayOfWeek };
}

/** Rolling onboarding window: today through today + 13 days (14 calendar dates). */
export function getOnboardingAvailabilityWindow(today: string): {
  start: string;
  end: string;
} {
  return {
    start: today,
    end: addDaysToDateString(today, 13),
  };
}

/** The 14 calendar dates shown during guided onboarding (today → today + 13). */
export function buildRollingOnboardingDays(today: string): AnchoredOnboardingDay[] {
  const days: AnchoredOnboardingDay[] = [];
  for (let offset = 0; offset < 14; offset++) {
    const calendarDate = addDaysToDateString(today, offset);
    const { weekStartDate, dayOfWeek } = weekDayFromCalendarDate(calendarDate);
    days.push({
      calendarDate,
      weekIndex: offset < 7 ? 1 : 2,
      dayOfWeek,
      weekStartDate,
    });
  }
  return days;
}

/** @deprecated Legacy Monday-anchored onboarding weeks; retained for reference only. */
export function buildAnchoredOnboardingDays(week1Start: string): AnchoredOnboardingDay[] {
  const week2Start = addDaysToDateString(week1Start, 7);
  const days: AnchoredOnboardingDay[] = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    days.push({
      calendarDate: calendarDateFromWeekDay(week1Start, dayOfWeek),
      weekIndex: 1,
      dayOfWeek,
      weekStartDate: week1Start,
    });
  }
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    days.push({
      calendarDate: calendarDateFromWeekDay(week2Start, dayOfWeek),
      weekIndex: 2,
      dayOfWeek,
      weekStartDate: week2Start,
    });
  }
  return days;
}

export function isCalendarDateInOnboardingWindow(calendarDate: string, today: string): boolean {
  const { start, end } = getOnboardingAvailabilityWindow(today);
  return (
    compareDateStrings(calendarDate, start) >= 0 && compareDateStrings(calendarDate, end) <= 0
  );
}

export function computeOnboardingDayStatus(
  calendarDate: string,
  today: string,
  windowCount: number,
  isUnavailable: boolean,
): OnboardingDayStatus {
  if (compareDateStrings(calendarDate, today) < 0) {
    return 'exempt_past';
  }
  if (windowCount > 0) {
    return 'available';
  }
  if (isUnavailable) {
    return 'unavailable';
  }
  return 'incomplete';
}

export function isOnboardingWeekComplete(
  days: Array<{ weekIndex: 1 | 2; status: OnboardingDayStatus }>,
  weekIndex: 1 | 2,
): boolean {
  return days.filter((d) => d.weekIndex === weekIndex).every((d) => d.status !== 'incomplete');
}

export function canCompleteGuidedOnboarding(
  days: Array<{ weekIndex: 1 | 2; status: OnboardingDayStatus }>,
): boolean {
  return isOnboardingWeekComplete(days, 1) && isOnboardingWeekComplete(days, 2);
}

export function isAnchoredOnboardingWeekStart(
  week1Start: string,
  weekStartDate: string,
): boolean {
  return weekStartDate === week1Start || weekStartDate === addDaysToDateString(week1Start, 7);
}
