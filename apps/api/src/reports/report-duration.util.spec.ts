import { describe, expect, it } from 'vitest';
import { deriveScheduledShiftMinutes } from './report-duration.util';

describe('deriveScheduledShiftMinutes', () => {
  it('computes standard shift durations', () => {
    expect(deriveScheduledShiftMinutes('09:00', '17:00')).toBe(480);
    expect(deriveScheduledShiftMinutes('09:15', '16:45')).toBe(450);
    expect(deriveScheduledShiftMinutes('08:00:00', '08:15:00')).toBe(15);
  });

  it('rejects equal start and end', () => {
    expect(() => deriveScheduledShiftMinutes('09:00', '09:00')).toThrow(/after start/);
  });

  it('rejects end before start', () => {
    expect(() => deriveScheduledShiftMinutes('17:00', '09:00')).toThrow(/after start/);
  });

  it('rejects malformed times', () => {
    expect(() => deriveScheduledShiftMinutes('9am', '17:00')).toThrow(/Invalid wall-clock/);
  });
});
