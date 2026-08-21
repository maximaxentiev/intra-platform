import {
  addReportCalendarDays,
  compareReportDateStrings,
  formatReportDateOnly,
  parseReportDateOnly,
  REPORT_TIMEZONE,
  torontoTodayDateString,
} from '../reports/report-date.util';

/** Dashboard business calendar uses the same America/Toronto semantics as Ops reporting. */
export const DASHBOARD_TIMEZONE = REPORT_TIMEZONE;

/** Rolling 24-hour urgent pending window from the current instant. */
export const URGENT_PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface DashboardCalendarContext {
  /** Current Toronto calendar date (YYYY-MM-DD). */
  today: string;
  /** Toronto calendar date immediately after today. */
  tomorrow: string;
  /** Inclusive lower bound for Next 7 Days (tomorrow). */
  next7DaysFrom: string;
  /** Inclusive upper bound for Next 7 Days (today + 7 calendar days). */
  next7DaysTo: string;
}

/** Resolve Toronto calendar anchors used by the Dashboard overview. */
export function resolveDashboardCalendarContext(now: Date = new Date()): DashboardCalendarContext {
  const today = torontoTodayDateString(now);
  const todayDate = parseReportDateOnly(today);
  const tomorrow = formatReportDateOnly(addReportCalendarDays(todayDate, 1));
  const next7DaysTo = formatReportDateOnly(addReportCalendarDays(todayDate, 7));

  return {
    today,
    tomorrow,
    next7DaysFrom: tomorrow,
    next7DaysTo,
  };
}

/** Coarse date filter for urgent pending queries — shifts beyond tomorrow cannot fall within 24h. */
export function urgentPendingCoarseDateUpperBound(today: string): string {
  return formatReportDateOnly(
    addReportCalendarDays(parseReportDateOnly(today), 1),
  );
}

export function isShiftDateOnOrAfterToday(shiftDate: string, today: string): boolean {
  return compareReportDateStrings(shiftDate, today) >= 0;
}
