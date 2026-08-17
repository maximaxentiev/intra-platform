import { describe, expect, it } from 'vitest';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
  normalizeShiftRoleNeeded,
} from './shift-assignment-display.util';

describe('shift assignment display helpers', () => {
  it('formats full calendar date labels', () => {
    const label = formatShiftAssignmentDateLabel('2026-08-25');
    expect(label).toContain('Tuesday');
    expect(label).toContain('August');
    expect(label).toContain('2026');
  });

  it('formats 12-hour time ranges from wall-clock values', () => {
    expect(formatShiftAssignmentTimeRange('08:30:00', '16:30:00')).toBe('8:30 AM – 4:30 PM');
  });

  it('normalizes blank roles to null', () => {
    expect(normalizeShiftRoleNeeded('ECE')).toBe('ECE');
    expect(normalizeShiftRoleNeeded('  ')).toBeNull();
    expect(normalizeShiftRoleNeeded(null)).toBeNull();
  });
});
