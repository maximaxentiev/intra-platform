import {
  assertIntegerRangeValid,
  matchesIntegerRange,
  type IntegerRangeFilter,
} from './report-metric-range.util';
import {
  assertMinutesRangeValid,
  parseOptionalHoursToMinutes,
} from './report-hours-filter.util';

export interface StaffUsageMetricFilters {
  completedShifts?: IntegerRangeFilter;
  completedScheduledMinutes?: IntegerRangeFilter;
  filledShifts?: IntegerRangeFilter;
  filledScheduledMinutes?: IntegerRangeFilter;
}

export interface StaffUsageRowMetrics {
  completedShifts: number;
  completedScheduledMinutes: number;
  filledShifts: number;
  filledScheduledMinutes: number;
}

export function resolveStaffUsageMetricFilters(input: {
  completedShiftsMin?: number;
  completedShiftsMax?: number;
  completedScheduledHoursMin?: number;
  completedScheduledHoursMax?: number;
  filledShiftsMin?: number;
  filledShiftsMax?: number;
  filledScheduledHoursMin?: number;
  filledScheduledHoursMax?: number;
}): StaffUsageMetricFilters {
  assertIntegerRangeValid(input.completedShiftsMin, input.completedShiftsMax, 'Completed Shifts');
  assertIntegerRangeValid(input.filledShiftsMin, input.filledShiftsMax, 'Filled Shifts');

  const completedScheduledMinutesMin = parseOptionalHoursToMinutes(input.completedScheduledHoursMin);
  const completedScheduledMinutesMax = parseOptionalHoursToMinutes(input.completedScheduledHoursMax);
  const filledScheduledMinutesMin = parseOptionalHoursToMinutes(input.filledScheduledHoursMin);
  const filledScheduledMinutesMax = parseOptionalHoursToMinutes(input.filledScheduledHoursMax);

  assertMinutesRangeValid(
    completedScheduledMinutesMin,
    completedScheduledMinutesMax,
    'Scheduled Hours on Completed Shifts',
  );
  assertMinutesRangeValid(
    filledScheduledMinutesMin,
    filledScheduledMinutesMax,
    'Scheduled Hours on Filled Shifts',
  );

  return {
    completedShifts: { min: input.completedShiftsMin, max: input.completedShiftsMax },
    completedScheduledMinutes: {
      min: completedScheduledMinutesMin,
      max: completedScheduledMinutesMax,
    },
    filledShifts: { min: input.filledShiftsMin, max: input.filledShiftsMax },
    filledScheduledMinutes: {
      min: filledScheduledMinutesMin,
      max: filledScheduledMinutesMax,
    },
  };
}

export function staffRowMatchesMetricFilters(
  row: StaffUsageRowMetrics,
  filters: StaffUsageMetricFilters,
): boolean {
  if (!matchesIntegerRange(row.completedShifts, filters.completedShifts ?? {})) return false;
  if (
    !matchesIntegerRange(row.completedScheduledMinutes, filters.completedScheduledMinutes ?? {})
  ) {
    return false;
  }
  if (!matchesIntegerRange(row.filledShifts, filters.filledShifts ?? {})) return false;
  if (!matchesIntegerRange(row.filledScheduledMinutes, filters.filledScheduledMinutes ?? {})) {
    return false;
  }
  return true;
}

export function buildStaffUsageSummaryFromRows(
  rows: Array<StaffUsageRowMetrics & { staffId: string }>,
) {
  return rows.reduce(
    (acc, row) => ({
      totalStaff: acc.totalStaff + 1,
      completedShifts: acc.completedShifts + row.completedShifts,
      completedScheduledMinutes:
        acc.completedScheduledMinutes + row.completedScheduledMinutes,
      filledShifts: acc.filledShifts + row.filledShifts,
      filledScheduledMinutes: acc.filledScheduledMinutes + row.filledScheduledMinutes,
    }),
    {
      totalStaff: 0,
      completedShifts: 0,
      completedScheduledMinutes: 0,
      filledShifts: 0,
      filledScheduledMinutes: 0,
    },
  );
}
