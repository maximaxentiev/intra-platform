import type { ReportFillRatePercent } from './types/report-response.types';
import {
  assertIntegerRangeValid,
  type FillRateRangeFilter,
  type IntegerRangeFilter,
  matchesFillRateRange,
  matchesIntegerRange,
} from './report-metric-range.util';
import {
  assertMinutesRangeValid,
  parseOptionalHoursToMinutes,
} from './report-hours-filter.util';
import { computeFillRatePercent } from './report-percentage.util';

export interface CentreShiftMetricFilters {
  totalShifts?: IntegerRangeFilter;
  fillRate?: FillRateRangeFilter;
  pending?: IntegerRangeFilter;
  filled?: IntegerRangeFilter;
  completed?: IntegerRangeFilter;
  cancelled?: IntegerRangeFilter;
}

export interface CentreScheduledHoursFilters extends CentreShiftMetricFilters {
  totalScheduledMinutes?: IntegerRangeFilter;
  completedScheduledMinutes?: IntegerRangeFilter;
}

export interface CentreMetricsBaseRow {
  centreId: string;
  centreName: string;
  totalShifts: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  fillRatePercent: ReportFillRatePercent;
}

export interface CentreMetricsFullRow extends CentreMetricsBaseRow {
  totalScheduledMinutes: number;
  completedScheduledMinutes: number;
}

export function resolveCentreShiftMetricFilters(input: {
  totalShiftsMin?: number;
  totalShiftsMax?: number;
  fillRateMin?: number;
  fillRateMax?: number;
  pendingMin?: number;
  pendingMax?: number;
  filledMin?: number;
  filledMax?: number;
  completedMin?: number;
  completedMax?: number;
  cancelledMin?: number;
  cancelledMax?: number;
}): CentreShiftMetricFilters {
  assertIntegerRangeValid(input.totalShiftsMin, input.totalShiftsMax, 'Total Shifts');
  assertIntegerRangeValid(input.pendingMin, input.pendingMax, 'Pending');
  assertIntegerRangeValid(input.filledMin, input.filledMax, 'Filled');
  assertIntegerRangeValid(input.completedMin, input.completedMax, 'Completed');
  assertIntegerRangeValid(input.cancelledMin, input.cancelledMax, 'Cancelled');
  assertIntegerRangeValid(input.fillRateMin, input.fillRateMax, 'Fill Rate');

  return {
    totalShifts: { min: input.totalShiftsMin, max: input.totalShiftsMax },
    fillRate: { min: input.fillRateMin, max: input.fillRateMax },
    pending: { min: input.pendingMin, max: input.pendingMax },
    filled: { min: input.filledMin, max: input.filledMax },
    completed: { min: input.completedMin, max: input.completedMax },
    cancelled: { min: input.cancelledMin, max: input.cancelledMax },
  };
}

export function resolveCentreScheduledHoursFilters(input: {
  scheduledHoursMin?: number;
  scheduledHoursMax?: number;
  completedScheduledHoursMin?: number;
  completedScheduledHoursMax?: number;
}): Pick<CentreScheduledHoursFilters, 'totalScheduledMinutes' | 'completedScheduledMinutes'> {
  const totalScheduledMinutesMin = parseOptionalHoursToMinutes(input.scheduledHoursMin);
  const totalScheduledMinutesMax = parseOptionalHoursToMinutes(input.scheduledHoursMax);
  const completedScheduledMinutesMin = parseOptionalHoursToMinutes(input.completedScheduledHoursMin);
  const completedScheduledMinutesMax = parseOptionalHoursToMinutes(
    input.completedScheduledHoursMax,
  );

  assertMinutesRangeValid(
    totalScheduledMinutesMin,
    totalScheduledMinutesMax,
    'Scheduled Hours',
  );
  assertMinutesRangeValid(
    completedScheduledMinutesMin,
    completedScheduledMinutesMax,
    'Scheduled Hours on Completed Shifts',
  );

  return {
    totalScheduledMinutes: {
      min: totalScheduledMinutesMin,
      max: totalScheduledMinutesMax,
    },
    completedScheduledMinutes: {
      min: completedScheduledMinutesMin,
      max: completedScheduledMinutesMax,
    },
  };
}

export function centreRowMatchesShiftMetricFilters(
  row: CentreMetricsBaseRow,
  filters: CentreShiftMetricFilters,
): boolean {
  if (!matchesIntegerRange(row.totalShifts, filters.totalShifts ?? {})) return false;
  if (!matchesFillRateRange(row.fillRatePercent, filters.fillRate ?? {})) return false;
  if (!matchesIntegerRange(row.pending, filters.pending ?? {})) return false;
  if (!matchesIntegerRange(row.filled, filters.filled ?? {})) return false;
  if (!matchesIntegerRange(row.completed, filters.completed ?? {})) return false;
  if (!matchesIntegerRange(row.cancelled, filters.cancelled ?? {})) return false;
  return true;
}

export function centreRowMatchesScheduledHoursFilters(
  row: CentreMetricsFullRow,
  filters: Pick<CentreScheduledHoursFilters, 'totalScheduledMinutes' | 'completedScheduledMinutes'>,
): boolean {
  if (!matchesIntegerRange(row.totalScheduledMinutes, filters.totalScheduledMinutes ?? {})) {
    return false;
  }
  if (
    !matchesIntegerRange(row.completedScheduledMinutes, filters.completedScheduledMinutes ?? {})
  ) {
    return false;
  }
  return true;
}

export function buildShiftFulfillmentSummaryFromRows(rows: CentreMetricsBaseRow[]) {
  const totals = rows.reduce(
    (acc, row) => ({
      totalCentres: acc.totalCentres + 1,
      totalShifts: acc.totalShifts + row.totalShifts,
      pending: acc.pending + row.pending,
      filled: acc.filled + row.filled,
      completed: acc.completed + row.completed,
      cancelled: acc.cancelled + row.cancelled,
    }),
    {
      totalCentres: 0,
      totalShifts: 0,
      pending: 0,
      filled: 0,
      completed: 0,
      cancelled: 0,
    },
  );

  return {
    ...totals,
    fillRatePercent: computeFillRatePercent(totals.filled, totals.completed, totals.pending),
  };
}

export function buildCentreUsageSummaryFromRows(rows: CentreMetricsFullRow[]) {
  const totals = rows.reduce(
    (acc, row) => ({
      totalCentres: acc.totalCentres + 1,
      totalShifts: acc.totalShifts + row.totalShifts,
      pending: acc.pending + row.pending,
      filled: acc.filled + row.filled,
      completed: acc.completed + row.completed,
      cancelled: acc.cancelled + row.cancelled,
      totalScheduledMinutes: acc.totalScheduledMinutes + row.totalScheduledMinutes,
      totalCompletedScheduledMinutes:
        acc.totalCompletedScheduledMinutes + row.completedScheduledMinutes,
    }),
    {
      totalCentres: 0,
      totalShifts: 0,
      pending: 0,
      filled: 0,
      completed: 0,
      cancelled: 0,
      totalScheduledMinutes: 0,
      totalCompletedScheduledMinutes: 0,
    },
  );

  return {
    ...totals,
    fillRatePercent: computeFillRatePercent(totals.filled, totals.completed, totals.pending),
  };
}

export function toShiftFulfillmentRow(row: CentreMetricsBaseRow) {
  return {
    centreId: row.centreId,
    centreName: row.centreName,
    totalShifts: row.totalShifts,
    pending: row.pending,
    filled: row.filled,
    completed: row.completed,
    cancelled: row.cancelled,
    fillRatePercent: row.fillRatePercent,
  };
}

export function toCentreUsageRow(row: CentreMetricsFullRow) {
  return {
    centreId: row.centreId,
    centreName: row.centreName,
    totalShifts: row.totalShifts,
    pending: row.pending,
    filled: row.filled,
    completed: row.completed,
    cancelled: row.cancelled,
    fillRatePercent: row.fillRatePercent,
    totalScheduledMinutes: row.totalScheduledMinutes,
    completedScheduledMinutes: row.completedScheduledMinutes,
  };
}
