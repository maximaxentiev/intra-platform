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

describe('VSC processed date + 1 calendar year', () => {
  it('adds exactly one calendar year for a normal date', () => {
    expect(deriveVscExpiryDate('2026-08-19')).toBe('2027-08-19');
  });

  it('adds one calendar year from another normal processed date', () => {
    expect(deriveVscExpiryDate('2026-09-04')).toBe('2027-09-04');
  });

  it('handles leap-day processed dates (2028-02-29 → 2029-02-28)', () => {
    expect(deriveVscExpiryDate('2028-02-29')).toBe('2029-02-28');
  });

  it('handles earlier leap-day convention (2020-02-29 → 2021-02-28)', () => {
    expect(deriveVscExpiryDate('2020-02-29')).toBe('2021-02-28');
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

describe('VSC one-year compliance boundaries', () => {
  const processed = '2025-08-19';
  const expiry = deriveVscExpiryDate(processed);

  it('stores renewal due one calendar year after processed date', () => {
    expect(expiry).toBe('2026-08-19');
  });

  it('is current more than 30 days before one-year expiry', () => {
    expect(deriveExpiryDisplay(expiry, startOfUtcDay(new Date('2026-07-01')))).toBe('current');
  });

  it('is expiring_soon on one-year expiry day', () => {
    expect(deriveExpiryDisplay(expiry, startOfUtcDay(new Date('2026-08-19')))).toBe('expiring_soon');
  });

  it('is expired after one-year expiry', () => {
    expect(deriveExpiryDisplay(expiry, startOfUtcDay(new Date('2026-08-20')))).toBe('expired');
  });
});

describe('calendar helpers', () => {
  it('round-trips date-only values', () => {
    const d = parseDateOnly('2024-01-05');
    expect(formatDateOnly(d)).toBe('2024-01-05');
    expect(formatDateOnly(addCalendarYears(d, 1))).toBe('2025-01-05');
  });
});
