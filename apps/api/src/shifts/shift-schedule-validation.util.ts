import { BadRequestException } from '@nestjs/common';

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function timeStringToMinutes(time: string): number {
  const trimmed = time.trim();
  const match = TIME_RE.exec(trimmed);
  if (!match) {
    throw new BadRequestException(`Invalid wall-clock time "${time}".`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new BadRequestException(`Invalid wall-clock time "${time}".`);
  }
  return hour * 60 + minute;
}

/** Same-day shifts only: end must be strictly after start. */
export function assertSameDayShiftSchedule(startTime: string, endTime: string): void {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    throw new BadRequestException('Shift end time must be after start time.');
  }
}
