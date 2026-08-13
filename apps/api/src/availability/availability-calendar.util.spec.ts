import { describe, expect, it } from 'vitest';
import { calendarDateFromWeekDay, isMondayDateString } from './availability-calendar.util';

describe('calendarDateFromWeekDay', () => {
  it('maps Monday week start and day indices to calendar dates', () => {
    expect(calendarDateFromWeekDay('2026-08-10', 0)).toBe('2026-08-10');
    expect(calendarDateFromWeekDay('2026-08-10', 1)).toBe('2026-08-11');
    expect(calendarDateFromWeekDay('2026-08-10', 6)).toBe('2026-08-16');
  });
});

describe('isMondayDateString', () => {
  it('accepts Mondays and rejects other weekdays', () => {
    expect(isMondayDateString('2026-08-10')).toBe(true);
    expect(isMondayDateString('2026-08-11')).toBe(false);
  });
});
