import { describe, expect, it } from 'vitest';
import { TZDate } from '@date-fns/tz';
import {
  resolveDashboardCalendarContext,
  urgentPendingCoarseDateUpperBound,
  DASHBOARD_TIMEZONE,
} from './dashboard-date.util';
import { addReportCalendarDays, formatReportDateOnly, parseReportDateOnly } from '../reports/report-date.util';

describe('dashboard-date.util', () => {
  it('uses America/Toronto timezone constant', () => {
    expect(DASHBOARD_TIMEZONE).toBe('America/Toronto');
  });

  it('resolves tomorrow as Toronto today + 1 calendar day', () => {
    const now = new Date('2026-08-21T15:00:00.000Z');
    const context = resolveDashboardCalendarContext(now);
    expect(context.today).toBe('2026-08-21');
    expect(context.tomorrow).toBe('2026-08-22');
  });

  it('resolves Next 7 Days as tomorrow through today + 7 inclusive', () => {
    const now = new Date('2026-08-21T15:00:00.000Z');
    const context = resolveDashboardCalendarContext(now);
    expect(context.next7DaysFrom).toBe('2026-08-22');
    expect(context.next7DaysTo).toBe('2026-08-28');
  });

  it('uses Toronto calendar date when UTC date differs', () => {
    // 2026-08-21 04:00 UTC is still 2026-08-20 evening in Toronto (EDT, UTC-4)
    const lateUtcEvening = new Date('2026-08-21T03:30:00.000Z');
    const context = resolveDashboardCalendarContext(lateUtcEvening);
    expect(context.today).toBe('2026-08-20');
    expect(context.tomorrow).toBe('2026-08-21');
    expect(context.next7DaysFrom).toBe('2026-08-21');
    expect(context.next7DaysTo).toBe('2026-08-27');
  });

  it('handles month boundary for tomorrow and +7 days', () => {
    const jan31 = new TZDate(2026, 0, 31, 12, 0, 0, DASHBOARD_TIMEZONE);
    const context = resolveDashboardCalendarContext(new Date(jan31.getTime()));
    expect(context.today).toBe('2026-01-31');
    expect(context.tomorrow).toBe('2026-02-01');
    expect(context.next7DaysTo).toBe('2026-02-07');
  });

  it('urgent coarse upper bound is tomorrow', () => {
    expect(urgentPendingCoarseDateUpperBound('2026-08-21')).toBe('2026-08-22');
  });

  it('adds calendar days deterministically across DST spring forward', () => {
    // Toronto springs forward 2026-03-08 — calendar math stays +1 day
    const beforeDst = parseReportDateOnly('2026-03-07');
    expect(formatReportDateOnly(addReportCalendarDays(beforeDst, 1))).toBe('2026-03-08');
    expect(formatReportDateOnly(addReportCalendarDays(beforeDst, 2))).toBe('2026-03-09');
  });
});
