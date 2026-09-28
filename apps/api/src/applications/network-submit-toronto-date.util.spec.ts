import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  isWorkPermitExpiryAtLeastSixMonths,
  minimumWorkPermitExpiryDate,
} from './network-submit-toronto-date.util';

describe('network-submit-toronto-date.util', () => {
  it('adds six calendar months with month-end clamping (Aug 31 → Feb 28)', () => {
    expect(addCalendarMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('adds six calendar months in a leap year (Aug 31 → Feb 29)', () => {
    expect(addCalendarMonths('2027-08-31', 6)).toBe('2028-02-29');
  });

  it('minimumWorkPermitExpiryDate is today + six months', () => {
    expect(minimumWorkPermitExpiryDate('2026-01-15')).toBe('2026-07-15');
  });

  it('accepts expiry exactly six months out', () => {
    const today = '2026-03-10';
    const expiry = minimumWorkPermitExpiryDate(today);
    expect(isWorkPermitExpiryAtLeastSixMonths(expiry, today)).toBe(true);
  });

  it('rejects expiry one day before six months', () => {
    const today = '2026-03-10';
    const min = minimumWorkPermitExpiryDate(today);
    const oneDayBefore = addCalendarMonths(min, 0);
    expect(oneDayBefore).toBe(min);
    expect(isWorkPermitExpiryAtLeastSixMonths('2026-09-09', today)).toBe(false);
  });

  it('accepts expiry more than six months out', () => {
    expect(isWorkPermitExpiryAtLeastSixMonths('2027-01-01', '2026-03-10')).toBe(true);
  });

  it('handles year boundary', () => {
    expect(minimumWorkPermitExpiryDate('2026-10-01')).toBe('2027-04-01');
  });
});
