import { BadRequestException } from '@nestjs/common';
import type { Availability } from '../db/schema';
import { calendarDateFromWeekDay, isMondayDateString } from './availability-calendar.util';
import { isDateBeforeTodayInToronto, parseCalendarDateString } from './availability-toronto.util';

const TIME_HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function assertValidWeekStartDate(weekStartDate: string): void {
  try {
    parseCalendarDateString(weekStartDate);
  } catch {
    throw new BadRequestException('weekStartDate must be a valid YYYY-MM-DD date.');
  }
  if (!isMondayDateString(weekStartDate)) {
    throw new BadRequestException('weekStartDate must be a Monday.');
  }
}

export function normalizeAvailabilityTimeHm(value: string, field: string): string {
  const trimmed = value.trim();
  const match = TIME_HM_RE.exec(trimmed);
  if (!match) {
    throw new BadRequestException(`${field} must be a valid HH:mm time.`);
  }
  return `${match[1]}:${match[2]}:00`;
}

export function assertStartBeforeEnd(startTime: string, endTime: string): void {
  if (startTime >= endTime) {
    throw new BadRequestException('startTime must be before endTime.');
  }
}

export function assertCalendarDateNotBeforeToday(
  weekStartDate: string,
  dayOfWeek: number,
  action: 'create' | 'update',
): void {
  const calendarDate = calendarDateFromWeekDay(weekStartDate, dayOfWeek);
  if (isDateBeforeTodayInToronto(calendarDate)) {
    throw new BadRequestException(
      action === 'create'
        ? 'Availability cannot be created for a past date.'
        : 'Availability for a past date cannot be edited.',
    );
  }
}

export function assertNoOverlap(
  candidate: { startTime: string; endTime: string },
  existing: Pick<Availability, 'id' | 'startTime' | 'endTime'>[],
  excludeId?: string,
): void {
  for (const row of existing) {
    if (excludeId && row.id === excludeId) {
      continue;
    }
    const existingStart = normalizeStoredTime(row.startTime);
    const existingEnd = normalizeStoredTime(row.endTime);
    if (candidate.startTime < existingEnd && candidate.endTime > existingStart) {
      if (candidate.startTime === existingStart && candidate.endTime === existingEnd) {
        throw new BadRequestException('An identical availability window already exists.');
      }
      throw new BadRequestException('This time range overlaps an existing availability window.');
    }
  }
}

function normalizeStoredTime(value: string): string {
  if (value.length === 5) {
    return `${value}:00`;
  }
  return value;
}

export function formatAvailabilityTimeForCarer(value: string): string {
  return value.slice(0, 5);
}
