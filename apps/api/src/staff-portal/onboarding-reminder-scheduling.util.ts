import { TZDate } from '@date-fns/tz';
import {
  AVAILABILITY_TIMEZONE,
  parseCalendarDateString,
  torontoTodayDateString,
} from '../availability/availability-toronto.util';
import {
  ONBOARDING_REMINDER_OFFSETS_DAYS,
  type OnboardingReminderOffsetDays,
} from './onboarding-reminder.types';

export type FutureOnboardingReminderPlan = {
  offsetDays: OnboardingReminderOffsetDays;
  scheduledFor: Date;
};

function addDaysToDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day + days));
  const y = probe.getUTCFullYear();
  const m = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const d = String(probe.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Toronto calendar date of the first portal invitation.
 * Uses staff_accounts.createdAt (write-once; unchanged by invitation resends).
 */
export function portalInvitationAnchorDate(createdAt: Date): string {
  return torontoTodayDateString(createdAt);
}

/** 09:00 America/Toronto on (anchor calendar date + offsetDays). */
export function torontoOnboardingReminderInstant(
  anchorDate: string,
  offsetDays: number,
  hour = 9,
): Date {
  const milestoneDate = addDaysToDateString(anchorDate, offsetDays);
  const { year, month, day } = parseCalendarDateString(milestoneDate);
  const toronto = new TZDate(year, month - 1, day, hour, 0, 0, AVAILABILITY_TIMEZONE);
  return new Date(toronto.getTime());
}

/** Future reminder milestones only — past-due intervals are omitted (no backfill). */
export function planFutureOnboardingReminders(
  anchorDate: string,
  now: Date = new Date(),
): FutureOnboardingReminderPlan[] {
  const plans: FutureOnboardingReminderPlan[] = [];
  for (const offsetDays of ONBOARDING_REMINDER_OFFSETS_DAYS) {
    const scheduledFor = torontoOnboardingReminderInstant(anchorDate, offsetDays);
    if (scheduledFor.getTime() > now.getTime()) {
      plans.push({ offsetDays, scheduledFor });
    }
  }
  return plans;
}
