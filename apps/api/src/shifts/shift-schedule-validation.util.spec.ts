import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertSameDayShiftSchedule } from './shift-schedule-validation.util';

describe('assertSameDayShiftSchedule', () => {
  it('accepts valid same-day ranges', () => {
    expect(() => assertSameDayShiftSchedule('09:00', '17:00')).not.toThrow();
    expect(() => assertSameDayShiftSchedule('09:00:00', '17:00:00')).not.toThrow();
  });

  it('rejects equal start and end', () => {
    expect(() => assertSameDayShiftSchedule('09:00', '09:00')).toThrow(BadRequestException);
    expect(() => assertSameDayShiftSchedule('09:00', '09:00')).toThrow(/after start time/);
  });

  it('rejects end before start', () => {
    expect(() => assertSameDayShiftSchedule('21:00', '13:00')).toThrow(BadRequestException);
    expect(() => assertSameDayShiftSchedule('17:00', '09:00')).toThrow(/after start time/);
  });
});
