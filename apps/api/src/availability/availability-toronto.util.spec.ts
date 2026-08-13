import { afterEach, describe, expect, it, vi } from 'vitest';
import * as torontoUtil from './availability-toronto.util';
import { compareDateStrings, torontoTodayDateString } from './availability-toronto.util';

describe('torontoTodayDateString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns America/Toronto calendar date without UTC rollover', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T03:30:00.000Z'));
    expect(torontoTodayDateString()).toBe('2026-08-12');
  });

  it('matches Toronto local date for midday UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T16:00:00.000Z'));
    expect(torontoTodayDateString()).toBe('2026-08-13');
  });
});

describe('compareDateStrings', () => {
  it('orders YYYY-MM-DD lexicographically', () => {
    expect(compareDateStrings('2026-08-12', '2026-08-13')).toBeLessThan(0);
    expect(compareDateStrings('2026-08-13', '2026-08-13')).toBe(0);
    expect(compareDateStrings('2026-08-14', '2026-08-13')).toBeGreaterThan(0);
  });
});

describe('torontoTodayDateString spy compatibility', () => {
  it('can be mocked in service tests', () => {
    vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue('2026-08-13');
    expect(torontoUtil.torontoTodayDateString()).toBe('2026-08-13');
    vi.restoreAllMocks();
  });
});
