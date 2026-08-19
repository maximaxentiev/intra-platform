import { describe, expect, it } from 'vitest';
import { computeFillRatePercent, roundReportPercent } from './report-percentage.util';

describe('computeFillRatePercent', () => {
  it('computes fill rate from pending, filled, and completed only', () => {
    expect(computeFillRatePercent(1, 7, 2)).toBe(80);
  });

  it('rounds to one decimal place', () => {
    expect(computeFillRatePercent(3, 4, 1)).toBe(87.5);
  });

  it('returns null when denominator is zero', () => {
    expect(computeFillRatePercent(0, 0, 0)).toBeNull();
  });

  it('returns 100 when all fillable shifts are filled or completed', () => {
    expect(computeFillRatePercent(2, 8, 0)).toBe(100);
  });
});

describe('roundReportPercent', () => {
  it('avoids long floating-point tails', () => {
    expect(roundReportPercent(87.456)).toBe(87.5);
    expect(roundReportPercent(100)).toBe(100);
    expect(roundReportPercent(0)).toBe(0);
  });
});
