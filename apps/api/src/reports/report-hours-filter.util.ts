import { BadRequestException } from '@nestjs/common';

/** Convert UI hours input to integer scheduled minutes for API filtering. */
export function parseOptionalHoursToMinutes(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestException('Scheduled hours filters must be >= 0.');
  }
  return Math.round(parsed * 60);
}

export function assertMinutesRangeValid(
  minMinutes: number | undefined,
  maxMinutes: number | undefined,
  label: string,
): void {
  if (minMinutes !== undefined && maxMinutes !== undefined && minMinutes > maxMinutes) {
    throw new BadRequestException(`${label} min cannot exceed max.`);
  }
}
