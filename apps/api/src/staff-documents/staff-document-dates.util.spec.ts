import { describe, expect, it } from 'vitest';
import {
  addCalendarYears,
  assertProcessedDateNotInFuture,
  deriveExpiryDisplay,
  deriveVscExpiryDate,
  formatDateOnly,
  parseDateOnly,
  startOfUtcDay,
} from './staff-document-dates.util';

describe('VSC processed date + 3 calendar years', () => {
  it('adds exactly three calendar years for a normal date', () => {
    expect(deriveVscExpiryDate('2022-06-15')).toBe('2025-06-15');
  });

  it('handles leap-day processed dates', () => {
    expect(deriveVscExpiryDate('2020-02-29')).toBe('2023-02-28');
  });

  it('rejects future processed dates', () => {
    expect(() =>
      assertProcessedDateNotInFuture('2099-01-01', startOfUtcDay(new Date('2026-01-01'))),
    ).toThrow(/future/i);
  });
});

describe('deriveExpiryDisplay', () => {
  const today = startOfUtcDay(new Date('2026-08-11'));

  it('returns no_expiry when expiry is null', () => {
    expect(deriveExpiryDisplay(null, today)).toBe('no_expiry');
  });

  it('returns current when expiry is more than 30 days away', () => {
    expect(deriveExpiryDisplay('2026-09-12', today)).toBe('current');
  });

  it('returns expiring_soon at exactly 30 days', () => {
    expect(deriveExpiryDisplay('2026-09-10', today)).toBe('expiring_soon');
  });

  it('returns expiring_soon at 29 days', () => {
    expect(deriveExpiryDisplay('2026-09-09', today)).toBe('expiring_soon');
  });

  it('returns expiring_soon on expiry day', () => {
    expect(deriveExpiryDisplay('2026-08-11', today)).toBe('expiring_soon');
  });

  it('returns expired for yesterday', () => {
    expect(deriveExpiryDisplay('2026-08-10', today)).toBe('expired');
  });
});

describe('calendar helpers', () => {
  it('round-trips date-only values', () => {
    const d = parseDateOnly('2024-01-05');
    expect(formatDateOnly(d)).toBe('2024-01-05');
    expect(formatDateOnly(addCalendarYears(d, 3))).toBe('2027-01-05');
  });
});
