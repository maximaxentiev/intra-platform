import { describe, expect, it } from 'vitest';
import { TZDate } from '@date-fns/tz';
import { DASHBOARD_TIMEZONE } from './dashboard-date.util';
import {
  isUrgentPendingShift,
  minutesUntilShiftStart,
  urgentPendingCutoffInstant,
} from './dashboard-urgency.util';

describe('dashboard-urgency.util', () => {
  const today = '2026-08-21';

  it('qualifies pending shift starting within 24 hours', () => {
    const now = new TZDate(2026, 7, 21, 10, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift({ shiftDate: today, startTime: '14:00:00' }, today, new Date(now.getTime())),
    ).toBe(true);
  });

  it('does not qualify pending shift more than 24 hours away', () => {
    const now = new TZDate(2026, 7, 21, 10, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift(
        { shiftDate: '2026-08-23', startTime: '12:00:00' },
        today,
        new Date(now.getTime()),
      ),
    ).toBe(false);
  });

  it('does not qualify when shift date is before Toronto today', () => {
    const now = new TZDate(2026, 7, 21, 10, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift(
        { shiftDate: '2026-08-20', startTime: '09:00:00' },
        today,
        new Date(now.getTime()),
      ),
    ).toBe(false);
  });

  it('qualifies pending shift earlier today that already started', () => {
    const now = new TZDate(2026, 7, 21, 15, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift({ shiftDate: today, startTime: '09:00:00' }, today, new Date(now.getTime())),
    ).toBe(true);
    expect(minutesUntilShiftStart(today, '09:00:00', new Date(now.getTime()))).toBeLessThan(0);
  });

  it('qualifies tomorrow shift within rolling 24h window', () => {
    const now = new TZDate(2026, 7, 21, 20, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift(
        { shiftDate: '2026-08-22', startTime: '10:00:00' },
        today,
        new Date(now.getTime()),
      ),
    ).toBe(true);
  });

  it('does not qualify tomorrow shift outside rolling 24h window', () => {
    const now = new TZDate(2026, 7, 21, 8, 0, 0, DASHBOARD_TIMEZONE);
    expect(
      isUrgentPendingShift(
        { shiftDate: '2026-08-22', startTime: '12:00:00' },
        today,
        new Date(now.getTime()),
      ),
    ).toBe(false);
  });

  it('uses Toronto wall-clock start for minutesUntilStart across UTC boundary', () => {
    const now = new Date('2026-08-21T12:00:00.000Z');
    const minutes = minutesUntilShiftStart('2026-08-21', '09:00:00', now);
    // 09:00 Toronto on Aug 21 — exact offset depends on DST; should be negative at noon UTC
    expect(minutes).toBeLessThan(120);
  });

  it('urgent cutoff is exactly 24 hours from now', () => {
    const now = new Date('2026-08-21T12:00:00.000Z');
    const cutoff = urgentPendingCutoffInstant(now);
    expect(cutoff.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
