import { describe, expect, it, vi } from 'vitest';
import {
  assertNoOverlap,
  assertStartBeforeEnd,
  normalizeAvailabilityTimeHm,
} from './availability-carer-validation.util';

describe('normalizeAvailabilityTimeHm', () => {
  it('accepts canonical HH:mm values', () => {
    expect(normalizeAvailabilityTimeHm('09:00', 'startTime')).toBe('09:00:00');
    expect(normalizeAvailabilityTimeHm('23:59', 'endTime')).toBe('23:59:00');
  });
});

describe('assertStartBeforeEnd', () => {
  it('rejects equal or reversed ranges', () => {
    expect(() => assertStartBeforeEnd('09:00:00', '09:00:00')).toThrow();
    expect(() => assertStartBeforeEnd('17:00:00', '09:00:00')).toThrow();
  });
});

describe('assertNoOverlap', () => {
  const existing = [
    { id: 'a', startTime: '09:00:00', endTime: '12:00:00' },
    { id: 'b', startTime: '14:00:00', endTime: '18:00:00' },
  ];

  it('allows adjacent windows', () => {
    expect(() =>
      assertNoOverlap({ startTime: '12:00:00', endTime: '14:00:00' }, existing),
    ).not.toThrow();
  });

  it('rejects overlapping windows', () => {
    expect(() =>
      assertNoOverlap({ startTime: '11:00:00', endTime: '15:00:00' }, existing),
    ).toThrow(/overlap/i);
  });

  it('rejects exact duplicates', () => {
    expect(() =>
      assertNoOverlap({ startTime: '09:00:00', endTime: '12:00:00' }, existing),
    ).toThrow(/identical/i);
  });

  it('excludes self on patch', () => {
    expect(() =>
      assertNoOverlap({ startTime: '09:30:00', endTime: '11:30:00' }, existing, 'a'),
    ).not.toThrow();
  });
});
