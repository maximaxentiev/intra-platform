import { describe, expect, it } from 'vitest';
import { carerAvailabilityDayLockSuffix } from './availability-carer-advisory-lock.util';

describe('carerAvailabilityDayLockSuffix', () => {
  it('combines week start and day index deterministically', () => {
    expect(carerAvailabilityDayLockSuffix('2026-08-10', 0)).toBe('2026-08-10:0');
    expect(carerAvailabilityDayLockSuffix('2026-08-10', 3)).toBe('2026-08-10:3');
  });

  it('differs for different days in the same week', () => {
    expect(carerAvailabilityDayLockSuffix('2026-08-10', 0)).not.toBe(
      carerAvailabilityDayLockSuffix('2026-08-10', 1),
    );
  });
});
