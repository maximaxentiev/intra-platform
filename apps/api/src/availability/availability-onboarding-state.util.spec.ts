import { describe, expect, it, vi } from 'vitest';
import * as torontoUtil from './availability-toronto.util';
import {
  addDaysToDateString,
  buildAnchoredOnboardingDays,
  canCompleteGuidedOnboarding,
  computeOnboardingDayStatus,
  isAnchoredOnboardingWeekStart,
  isOnboardingWeekComplete,
  mondayOfDateString,
  torontoMondayWeekStart,
} from './availability-onboarding-state.util';

describe('availability-onboarding-state.util', () => {
  it('mondayOfDateString returns Monday of the containing week', () => {
    expect(mondayOfDateString('2026-08-13')).toBe('2026-08-10');
    expect(mondayOfDateString('2026-08-10')).toBe('2026-08-10');
    expect(mondayOfDateString('2026-08-16')).toBe('2026-08-10');
    expect(mondayOfDateString('2026-08-17')).toBe('2026-08-17');
  });

  it('torontoMondayWeekStart uses Toronto today', () => {
    vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue('2026-08-13');
    expect(torontoMondayWeekStart()).toBe('2026-08-10');
    vi.restoreAllMocks();
  });

  it('buildAnchoredOnboardingDays returns 14 dates across two weeks', () => {
    const days = buildAnchoredOnboardingDays('2026-08-10');
    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({
      calendarDate: '2026-08-10',
      weekIndex: 1,
      dayOfWeek: 0,
      weekStartDate: '2026-08-10',
    });
    expect(days[7]).toMatchObject({
      calendarDate: '2026-08-17',
      weekIndex: 2,
      dayOfWeek: 0,
      weekStartDate: '2026-08-17',
    });
    expect(days[13]?.calendarDate).toBe('2026-08-23');
    expect(addDaysToDateString('2026-08-10', 7)).toBe('2026-08-17');
  });

  it('computeOnboardingDayStatus applies past exemption in both weeks', () => {
    const today = '2026-08-13';
    expect(computeOnboardingDayStatus('2026-08-12', today, 0, false)).toBe('exempt_past');
    expect(computeOnboardingDayStatus('2026-08-20', today, 0, false)).toBe('incomplete');
    expect(computeOnboardingDayStatus('2026-08-13', today, 0, false)).toBe('incomplete');
    expect(computeOnboardingDayStatus('2026-08-13', today, 1, false)).toBe('available');
    expect(computeOnboardingDayStatus('2026-08-14', today, 0, true)).toBe('unavailable');
  });

  it('week completion ignores exempt past days', () => {
    const days = [
      { weekIndex: 1 as const, status: 'exempt_past' as const },
      { weekIndex: 1 as const, status: 'available' as const },
      { weekIndex: 1 as const, status: 'unavailable' as const },
      { weekIndex: 2 as const, status: 'incomplete' as const },
    ];
    expect(isOnboardingWeekComplete(days, 1)).toBe(true);
    expect(isOnboardingWeekComplete(days, 2)).toBe(false);
    expect(canCompleteGuidedOnboarding(days)).toBe(false);
  });

  it('isAnchoredOnboardingWeekStart accepts only anchored weeks', () => {
    expect(isAnchoredOnboardingWeekStart('2026-08-10', '2026-08-10')).toBe(true);
    expect(isAnchoredOnboardingWeekStart('2026-08-10', '2026-08-17')).toBe(true);
    expect(isAnchoredOnboardingWeekStart('2026-08-10', '2026-08-24')).toBe(false);
  });
});
