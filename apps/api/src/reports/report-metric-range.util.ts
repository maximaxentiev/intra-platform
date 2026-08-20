import { BadRequestException } from '@nestjs/common';
import type { ReportFillRatePercent } from './types/report-response.types';

export interface IntegerRangeFilter {
  min?: number;
  max?: number;
}

export interface FillRateRangeFilter {
  min?: number;
  max?: number;
}

export function assertIntegerRangeValid(
  min: number | undefined,
  max: number | undefined,
  label: string,
): void {
  if (min !== undefined && max !== undefined && min > max) {
    throw new BadRequestException(`${label} min cannot exceed max.`);
  }
}

export function matchesIntegerRange(value: number, filter: IntegerRangeFilter): boolean {
  if (filter.min !== undefined && value < filter.min) return false;
  if (filter.max !== undefined && value > filter.max) return false;
  return true;
}

export function matchesFillRateRange(
  value: ReportFillRatePercent,
  filter: FillRateRangeFilter,
): boolean {
  if (value === null) {
    return filter.min === undefined;
  }
  if (filter.min !== undefined && value < filter.min) return false;
  if (filter.max !== undefined && value > filter.max) return false;
  return true;
}

export function parseOptionalNonNegativeInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException('Count filters must be integers >= 0.');
  }
  return parsed;
}

export function parseOptionalFillRatePercent(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new BadRequestException('Fill rate filters must be between 0 and 100.');
  }
  return parsed;
}
