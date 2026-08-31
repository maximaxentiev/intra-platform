import { describe, expect, it } from 'vitest';
import {
  computeCentreReportFillRateFromCombined,
  computeCentreReportFillRatePercent,
  computeFillRatePercent,
  roundReportPercent,
} from './report-percentage.util';
import { buildCentreReportMetricsFromStatusCounts } from './report-centre-metrics.util';

describe('computeCentreReportFillRatePercent', () => {
  it('excludes pending from numerator and denominator', () => {
    expect(computeCentreReportFillRatePercent(8, 12, 2)).toBe(90.9);
  });

  it('returns null when denominator is zero', () => {
    expect(computeCentreReportFillRatePercent(0, 0, 0)).toBeNull();
  });

  it('returns 100 when all fillable shifts are filled or completed and none cancelled', () => {
    expect(computeCentreReportFillRatePercent(2, 8, 0)).toBe(100);
  });
});

describe('computeCentreReportFillRateFromCombined', () => {
  it('matches combined filled semantics', () => {
    expect(computeCentreReportFillRateFromCombined(20, 2)).toBe(90.9);
  });
});

describe('computeFillRatePercent (dashboard legacy)', () => {
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

describe('centre report metrics fixture', () => {
  it('computes filled, hours, and fill rate per refined semantics', () => {
    const metrics = buildCentreReportMetricsFromStatusCounts({
      pending: { count: 3, minutes: 10 * 60 },
      filled: { count: 8, minutes: 30 * 60 },
      completed: { count: 12, minutes: 50 * 60 },
      cancelled: { count: 2, minutes: 24.5 * 60 },
    });

    expect(metrics.pending).toBe(3);
    expect(metrics.filled).toBe(20);
    expect(metrics.completed).toBe(12);
    expect(metrics.cancelled).toBe(2);
    expect(metrics.cancelledScheduledMinutes).toBe(24.5 * 60);
    expect(metrics.totalScheduledMinutes).toBe(114.5 * 60);
    expect(metrics.completedScheduledMinutes).toBe(50 * 60);
    expect(metrics.fillRatePercent).toBe(90.9);
  });
});
