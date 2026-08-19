import { describe, expect, it } from 'vitest';
import {
  deriveShiftScheduleVersion,
  normalizeWallClockTime,
  torontoShiftEndInstant,
  torontoShiftStartInstant,
} from './shift-toronto.util';
import { planFutureShiftReminders } from './shift-reminder-scheduling.util';
import { addMillisecondsToDate } from './shift-toronto.util';

describe('torontoShiftStartInstant', () => {
  it('converts EST winter wall clock to UTC', () => {
    const instant = torontoShiftStartInstant('2026-01-15', '09:00:00');
    expect(instant.toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('converts EDT summer wall clock to UTC', () => {
    const instant = torontoShiftStartInstant('2026-06-15', '09:00:00');
    expect(instant.toISOString()).toBe('2026-06-15T13:00:00.000Z');
  });

  it('handles spring DST transition (EDT after spring forward)', () => {
    // 2026-03-08 is spring forward in America/Toronto
    const instant = torontoShiftStartInstant('2026-03-09', '09:00:00');
    expect(instant.toISOString()).toBe('2026-03-09T13:00:00.000Z');
  });

  it('handles fall DST transition (EST after fall back)', () => {
    // 2026-11-01 is fall back in America/Toronto
    const instant = torontoShiftStartInstant('2026-11-02', '09:00:00');
    expect(instant.toISOString()).toBe('2026-11-02T14:00:00.000Z');
  });

  it('normalizes HH:mm to HH:mm:ss', () => {
    expect(normalizeWallClockTime('09:30')).toBe('09:30:00');
  });

  it('derives stable schedule version tokens', () => {
    expect(deriveShiftScheduleVersion('2026-09-01', '09:00:00')).toBe('2026-09-01_09-00-00');
  });
});

describe('torontoShiftEndInstant', () => {
  it('converts EST winter wall clock end to UTC', () => {
    const instant = torontoShiftEndInstant('2026-01-15', '17:00:00');
    expect(instant.toISOString()).toBe('2026-01-15T22:00:00.000Z');
  });

  it('converts EDT summer wall clock end to UTC', () => {
    const instant = torontoShiftEndInstant('2026-06-15', '17:00:00');
    expect(instant.toISOString()).toBe('2026-06-15T21:00:00.000Z');
  });

  it('handles spring DST transition', () => {
    const instant = torontoShiftEndInstant('2026-03-09', '17:00:00');
    expect(instant.toISOString()).toBe('2026-03-09T21:00:00.000Z');
  });

  it('handles fall DST transition', () => {
    const instant = torontoShiftEndInstant('2026-11-02', '17:00:00');
    expect(instant.toISOString()).toBe('2026-11-02T22:00:00.000Z');
  });
});

describe('planFutureShiftReminders', () => {
  const shiftDate = '2026-09-10';
  const startTime = '09:00:00';

  it('A. assignment 5 days ahead schedules 3d, 1d, 2h', () => {
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = addMillisecondsToDate(shiftStart, -5 * 24 * 60 * 60 * 1000);
    const plans = planFutureShiftReminders(shiftDate, startTime, now);
    expect(plans.map((p) => p.interval)).toEqual(['3d', '1d', '2h']);
  });

  it('B. assignment 2 days ahead schedules 1d and 2h only', () => {
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = addMillisecondsToDate(shiftStart, -2 * 24 * 60 * 60 * 1000);
    const plans = planFutureShiftReminders(shiftDate, startTime, now);
    expect(plans.map((p) => p.interval)).toEqual(['1d', '2h']);
  });

  it('C. assignment 12h ahead schedules 2h only', () => {
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = addMillisecondsToDate(shiftStart, -12 * 60 * 60 * 1000);
    const plans = planFutureShiftReminders(shiftDate, startTime, now);
    expect(plans.map((p) => p.interval)).toEqual(['2h']);
  });

  it('D. assignment <2h ahead schedules none', () => {
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = addMillisecondsToDate(shiftStart, -90 * 60 * 1000);
    const plans = planFutureShiftReminders(shiftDate, startTime, now);
    expect(plans).toEqual([]);
  });

  it('E. never returns past-due intervals as immediate send candidates', () => {
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = addMillisecondsToDate(shiftStart, -30 * 60 * 1000);
    const plans = planFutureShiftReminders(shiftDate, startTime, now);
    expect(plans).toEqual([]);
    for (const plan of plans) {
      expect(plan.scheduledFor.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it('reminder instants subtract from Toronto shift start across DST boundary', () => {
    const shiftStart = torontoShiftStartInstant('2026-03-09', '09:00:00');
    const now = addMillisecondsToDate(shiftStart, -4 * 24 * 60 * 60 * 1000);
    const plans = planFutureShiftReminders('2026-03-09', '09:00:00', now);
    const threeDay = plans.find((p) => p.interval === '3d');
    expect(threeDay).toBeDefined();
    expect(threeDay!.scheduledFor.toISOString()).toBe('2026-03-06T13:00:00.000Z');
  });
});
