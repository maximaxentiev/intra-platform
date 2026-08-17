import { compareDateStrings } from '../availability/availability-toronto.util';
import type { CarerShiftStatus } from './dto/staff-portal-shifts.dto';

export type ShiftInternalStatus = 'pending' | 'filled' | 'cancelled' | 'completed';

export type ShiftRowForCarer = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  status: ShiftInternalStatus;
  centreName: string;
  centreAddress: string;
  centreCity: string;
};

/** Normalize stored role text; blank/whitespace becomes null for Carer DTOs. */
export function normalizeCarerShiftRole(roleNeeded: string): string | null {
  const trimmed = roleNeeded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Format a PostgreSQL time value for Carer display (HH:mm). */
export function formatShiftTimeForCarer(value: string): string {
  return value.slice(0, 5);
}

/**
 * Map internal shift status to Carer-facing status.
 * Filled shifts whose Toronto end time has passed are presented as completed
 * even when cron has not yet updated the row.
 */
export function mapCarerShiftStatus(
  internalStatus: ShiftInternalStatus,
  shiftDate: string,
  endTime: string,
  today: string,
  nowTime: string,
): CarerShiftStatus | null {
  if (internalStatus === 'pending') return null;
  if (internalStatus === 'cancelled') return 'cancelled';
  if (internalStatus === 'completed') return 'completed';
  if (internalStatus === 'filled') {
    if (compareDateStrings(shiftDate, today) > 0) return 'upcoming';
    if (shiftDate === today) {
      return endTime > nowTime ? 'today' : 'completed';
    }
    return 'completed';
  }
  return null;
}

/** True when an assigned shift belongs in the Carer Upcoming list. */
export function isCarerUpcomingShift(
  internalStatus: ShiftInternalStatus,
  shiftDate: string,
  endTime: string,
  today: string,
  nowTime: string,
): boolean {
  if (internalStatus === 'pending') return false;
  if (internalStatus === 'cancelled') {
    return compareDateStrings(shiftDate, today) >= 0;
  }
  if (internalStatus === 'filled') {
    if (compareDateStrings(shiftDate, today) > 0) return true;
    if (shiftDate === today) return endTime > nowTime;
    return false;
  }
  return false;
}

/** True when an assigned shift belongs in the Carer History list. */
export function isCarerHistoryShift(
  internalStatus: ShiftInternalStatus,
  shiftDate: string,
  endTime: string,
  today: string,
  nowTime: string,
): boolean {
  if (internalStatus === 'pending') return false;
  if (internalStatus === 'completed') return true;
  if (internalStatus === 'cancelled') {
    return compareDateStrings(shiftDate, today) < 0;
  }
  if (internalStatus === 'filled') {
    if (compareDateStrings(shiftDate, today) < 0) return true;
    if (shiftDate === today) return endTime <= nowTime;
    return false;
  }
  return false;
}

export function toCarerShiftSummaryDto(
  row: ShiftRowForCarer,
  today: string,
  nowTime: string,
): import('./dto/staff-portal-shifts.dto').CarerShiftSummaryDto | null {
  const status = mapCarerShiftStatus(row.status, row.shiftDate, row.endTime, today, nowTime);
  if (!status) return null;

  return {
    id: row.id,
    shiftDate: row.shiftDate,
    startTime: formatShiftTimeForCarer(row.startTime),
    endTime: formatShiftTimeForCarer(row.endTime),
    roleNeeded: normalizeCarerShiftRole(row.roleNeeded),
    status,
    centre: {
      name: row.centreName,
      address: row.centreAddress,
      city: row.centreCity,
    },
  };
}
