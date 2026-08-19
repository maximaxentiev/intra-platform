import { BadRequestException } from '@nestjs/common';
import { normalizeWallClockTime } from './shift-toronto.util';

export const SHIFT_HOURS_INCREMENT_MINUTES = 15;
export const SHIFT_HOURS_MIN_DURATION_MINUTES = 15;
export const SHIFT_HOURS_MAX_DURATION_MINUTES = 16 * 60;
export const SHIFT_HOURS_MAX_EARLY_START_MINUTES = 2 * 60;
export const SHIFT_HOURS_MAX_LATE_END_MINUTES = 4 * 60;

const TIME_INPUT_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export class ShiftHoursValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftHoursValidationError';
  }
}

export function wallClockToMinutes(time: string): number {
  const normalized = normalizeWallClockTime(time);
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

export function deriveSameDayDurationMinutes(startTime: string, endTime: string): number {
  const startMinutes = wallClockToMinutes(startTime);
  const endMinutes = wallClockToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    throw new ShiftHoursValidationError('Actual end time must be after actual start time on the same day.');
  }
  return endMinutes - startMinutes;
}

export function deriveScheduledDurationMinutes(startTime: string, endTime: string): number {
  return deriveSameDayDurationMinutes(startTime, endTime);
}

export type ValidatedShiftActualHours = {
  actualStartTime: string;
  actualEndTime: string;
  actualTotalMinutes: number;
};

export type ValidateActualHoursParams = {
  actualStartTime: string;
  actualEndTime: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
};

export function validateActualHoursInput(params: ValidateActualHoursParams): ValidatedShiftActualHours {
  const startMatch = TIME_INPUT_RE.exec(params.actualStartTime.trim());
  const endMatch = TIME_INPUT_RE.exec(params.actualEndTime.trim());
  if (!startMatch || !endMatch) {
    throw new ShiftHoursValidationError('Times must use HH:mm format.');
  }

  for (const [, hour, minute] of [startMatch, endMatch]) {
    if (Number(minute) % SHIFT_HOURS_INCREMENT_MINUTES !== 0) {
      throw new ShiftHoursValidationError('Times must use 15-minute increments.');
    }
  }

  const actualStartTime = normalizeWallClockTime(params.actualStartTime);
  const actualEndTime = normalizeWallClockTime(params.actualEndTime);
  const scheduledStartTime = normalizeWallClockTime(params.scheduledStartTime);
  const scheduledEndTime = normalizeWallClockTime(params.scheduledEndTime);

  const actualTotalMinutes = deriveSameDayDurationMinutes(actualStartTime, actualEndTime);
  if (actualTotalMinutes < SHIFT_HOURS_MIN_DURATION_MINUTES) {
    throw new ShiftHoursValidationError('Actual worked duration must be at least 15 minutes.');
  }
  if (actualTotalMinutes > SHIFT_HOURS_MAX_DURATION_MINUTES) {
    throw new ShiftHoursValidationError('Actual worked duration cannot exceed 16 hours.');
  }

  const actualStartMinutes = wallClockToMinutes(actualStartTime);
  const actualEndMinutes = wallClockToMinutes(actualEndTime);
  const scheduledStartMinutes = wallClockToMinutes(scheduledStartTime);
  const scheduledEndMinutes = wallClockToMinutes(scheduledEndTime);

  if (actualStartMinutes < scheduledStartMinutes - SHIFT_HOURS_MAX_EARLY_START_MINUTES) {
    throw new ShiftHoursValidationError('Actual start time is too far before the scheduled start.');
  }
  if (actualEndMinutes > scheduledEndMinutes + SHIFT_HOURS_MAX_LATE_END_MINUTES) {
    throw new ShiftHoursValidationError('Actual end time is too far after the scheduled end.');
  }

  return {
    actualStartTime,
    actualEndTime,
    actualTotalMinutes,
  };
}

export function toShiftHoursBadRequest(error: unknown): BadRequestException {
  if (error instanceof ShiftHoursValidationError) {
    return new BadRequestException(error.message);
  }
  throw error;
}
