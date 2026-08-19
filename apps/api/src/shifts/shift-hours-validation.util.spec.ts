import { describe, expect, it } from 'vitest';
import {
  deriveSameDayDurationMinutes,
  ShiftHoursValidationError,
  validateActualHoursInput,
} from './shift-hours-validation.util';

const SCHEDULED = {
  scheduledStartTime: '09:00',
  scheduledEndTime: '17:00',
};

describe('validateActualHoursInput', () => {
  it('accepts 09:00–17:00 as 480 minutes', () => {
    const result = validateActualHoursInput({
      ...SCHEDULED,
      actualStartTime: '09:00',
      actualEndTime: '17:00',
    });
    expect(result.actualTotalMinutes).toBe(480);
    expect(result.actualStartTime).toBe('09:00:00');
    expect(result.actualEndTime).toBe('17:00:00');
  });

  it('accepts 09:15–16:45 as 450 minutes', () => {
    const result = validateActualHoursInput({
      ...SCHEDULED,
      actualStartTime: '09:15',
      actualEndTime: '16:45',
    });
    expect(result.actualTotalMinutes).toBe(450);
  });

  it('rejects non-15-minute increments', () => {
    expect(() =>
      validateActualHoursInput({
        ...SCHEDULED,
        actualStartTime: '09:10',
        actualEndTime: '17:00',
      }),
    ).toThrow(ShiftHoursValidationError);
  });

  it('rejects end <= start', () => {
    expect(() =>
      validateActualHoursInput({
        ...SCHEDULED,
        actualStartTime: '17:00',
        actualEndTime: '09:00',
      }),
    ).toThrow(ShiftHoursValidationError);
  });

  it('rejects duration under 15 minutes', () => {
    expect(() =>
      validateActualHoursInput({
        ...SCHEDULED,
        actualStartTime: '09:00',
        actualEndTime: '09:00',
      }),
    ).toThrow(ShiftHoursValidationError);
  });

  it('rejects duration over 16 hours', () => {
    expect(() =>
      validateActualHoursInput({
        scheduledStartTime: '00:00',
        scheduledEndTime: '23:45',
        actualStartTime: '00:00',
        actualEndTime: '16:15',
      }),
    ).toThrow(ShiftHoursValidationError);
  });

  it('allows early start within 2 hours', () => {
    const result = validateActualHoursInput({
      ...SCHEDULED,
      actualStartTime: '07:00',
      actualEndTime: '17:00',
    });
    expect(result.actualTotalMinutes).toBe(600);
  });

  it('rejects start too early', () => {
    expect(() =>
      validateActualHoursInput({
        ...SCHEDULED,
        actualStartTime: '06:45',
        actualEndTime: '17:00',
      }),
    ).toThrow(ShiftHoursValidationError);
  });

  it('allows late end within 4 hours', () => {
    const result = validateActualHoursInput({
      ...SCHEDULED,
      actualStartTime: '09:00',
      actualEndTime: '21:00',
    });
    expect(result.actualTotalMinutes).toBe(720);
  });

  it('rejects end too late', () => {
    expect(() =>
      validateActualHoursInput({
        ...SCHEDULED,
        actualStartTime: '09:00',
        actualEndTime: '21:15',
      }),
    ).toThrow(ShiftHoursValidationError);
  });
});

describe('deriveSameDayDurationMinutes', () => {
  it('derives scheduled duration', () => {
    expect(deriveSameDayDurationMinutes('09:00', '17:00')).toBe(480);
  });
});
