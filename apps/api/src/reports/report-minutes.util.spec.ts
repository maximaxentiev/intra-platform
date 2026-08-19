import { describe, expect, it } from 'vitest';
import { normalizeReportCount, normalizeReportScheduledMinutes } from './report-minutes.util';

describe('normalizeReportScheduledMinutes', () => {
  it('returns 0 for null and undefined', () => {
    expect(normalizeReportScheduledMinutes(null)).toBe(0);
    expect(normalizeReportScheduledMinutes(undefined)).toBe(0);
  });

  it('coerces string aggregates from PostgreSQL', () => {
    expect(normalizeReportScheduledMinutes('480')).toBe(480);
    expect(normalizeReportScheduledMinutes('450')).toBe(450);
    expect(normalizeReportScheduledMinutes('0')).toBe(0);
  });

  it('accepts finite numbers', () => {
    expect(normalizeReportScheduledMinutes(0)).toBe(0);
    expect(normalizeReportScheduledMinutes(1440)).toBe(1440);
  });

  it('rejects invalid values', () => {
    expect(() => normalizeReportScheduledMinutes('abc')).toThrow(/Invalid scheduled minutes/);
    expect(() => normalizeReportScheduledMinutes(-1)).toThrow(/Invalid scheduled minutes/);
  });
});

describe('normalizeReportCount', () => {
  it('coerces string counts', () => {
    expect(normalizeReportCount('11')).toBe(11);
    expect(normalizeReportCount(null)).toBe(0);
  });
});
