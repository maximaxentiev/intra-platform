import { describe, expect, it } from 'vitest';
import {
  formatReportShiftStatusLabel,
  resolveCentreUsageShiftDetailStatus,
} from './report-shift-status.util';

describe('report-shift-status.util', () => {
  it('defaults detail status to completed', () => {
    expect(resolveCentreUsageShiftDetailStatus(undefined)).toBe('completed');
  });

  it('formats shift status labels for CSV', () => {
    expect(formatReportShiftStatusLabel('completed')).toBe('Completed');
    expect(formatReportShiftStatusLabel('pending')).toBe('Pending');
  });
});
