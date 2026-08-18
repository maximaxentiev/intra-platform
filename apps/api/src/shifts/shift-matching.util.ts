import { normalizeShiftRoleNeeded } from './shift-assignment-display.util';
import type { SameDayStaffShift, ShiftEligibilityResult, ShiftMatchingTarget } from './shift-matching.types';
import type { StaffShiftDocumentGate } from '../staff-documents/staff-document-compliance.util';

export type ShiftEligibilityReason =
  | 'not_available'
  | 'shift_overlap'
  | 'prior_shift_buffer'
  | 'centre_banned'
  | 'inactive_staff'
  | 'no_portal_account'
  | 'account_disabled'
  | 'onboarding_incomplete'
  | 'documents_ineligible'
  | 'role_mismatch';

export type StaffEligibilityInput = {
  staffId: string;
  staffStatus: 'active' | 'inactive';
  staffRole: string;
  account: {
    status: 'invited' | 'incomplete' | 'active' | 'disabled';
    onboardingCompletedAt: Date | null;
  } | null;
  isCentreBanned: boolean;
  hasAvailabilityCoverage: boolean;
  sameDayShifts: SameDayStaffShift[];
  documentGate: StaffShiftDocumentGate;
  shift: ShiftMatchingTarget;
};

/** Trim staff role for comparison with shift.roleNeeded. */
export function normalizeStaffRoleForMatching(role: string | null | undefined): string | null {
  const trimmed = (role ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Strict same-calendar-day overlap on PostgreSQL time strings (HH:mm:ss). */
export function shiftsTimeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Add whole hours to a wall-clock time string; same-day only (no overnight support). */
export function addHoursToTimeString(time: string, hours: number): string {
  const [hRaw, mRaw, sRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const s = Number(sRaw ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const totalMinutes = h * 60 + m + hours * 60;
  const nh = Math.floor(totalMinutes / 60) % 24;
  const nm = totalMinutes % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Prior-shift buffer (V2): blocked when target starts less than 2 hours after prior ends.
 * Exactly 2 hours is allowed.
 */
export function violatesPriorShiftBuffer(priorEnd: string, targetStart: string): boolean {
  const earliestAllowedStart = addHoursToTimeString(priorEnd, 2);
  return targetStart < earliestAllowedStart;
}

/** One availability window must fully contain the shift interval. */
export function availabilityWindowCoversShift(
  windowStart: string,
  windowEnd: string,
  shiftStart: string,
  shiftEnd: string,
): boolean {
  return windowStart <= shiftStart && windowEnd >= shiftEnd;
}

export function staffRolesMatchForShift(
  shiftRoleNeeded: string,
  staffRole: string,
): boolean {
  const required = normalizeShiftRoleNeeded(shiftRoleNeeded);
  if (!required) return true;
  return normalizeStaffRoleForMatching(staffRole) === required;
}

function isOperationalOverlapShift(shift: SameDayStaffShift): boolean {
  return shift.status === 'filled' && Boolean(shift.assignedStaffId);
}

function isOperationalBufferPriorShift(shift: SameDayStaffShift): boolean {
  return (
    (shift.status === 'filled' || shift.status === 'completed') &&
    Boolean(shift.assignedStaffId)
  );
}

export function evaluateStaffShiftEligibility(input: StaffEligibilityInput): ShiftEligibilityResult {
  const reasons: ShiftEligibilityReason[] = [];

  if (input.staffStatus !== 'active') {
    reasons.push('inactive_staff');
  }

  if (!input.account) {
    reasons.push('no_portal_account');
  } else {
    if (input.account.status === 'disabled') {
      reasons.push('account_disabled');
    }
    if (!input.account.onboardingCompletedAt) {
      reasons.push('onboarding_incomplete');
    }
  }

  if (input.isCentreBanned) {
    reasons.push('centre_banned');
  }

  if (!staffRolesMatchForShift(input.shift.roleNeeded, input.staffRole)) {
    reasons.push('role_mismatch');
  }

  if (!input.hasAvailabilityCoverage) {
    reasons.push('not_available');
  }

  const staffSameDay = input.sameDayShifts.filter(
    (row) => row.assignedStaffId === input.staffId && row.id !== input.shift.id,
  );

  let hasOverlap = false;
  for (const other of staffSameDay) {
    if (other.status === 'cancelled') continue;
    if (!isOperationalOverlapShift(other)) continue;
    if (
      shiftsTimeOverlap(
        input.shift.startTime,
        input.shift.endTime,
        other.startTime,
        other.endTime,
      )
    ) {
      hasOverlap = true;
      reasons.push('shift_overlap');
      break;
    }
  }

  if (!hasOverlap) {
    for (const other of staffSameDay) {
      if (other.status === 'cancelled') continue;
      if (!isOperationalBufferPriorShift(other)) continue;
      if (other.endTime > input.shift.startTime) continue;
      if (violatesPriorShiftBuffer(other.endTime, input.shift.startTime)) {
        reasons.push('prior_shift_buffer');
        break;
      }
    }
  }

  if (!input.documentGate.eligible) {
    reasons.push('documents_ineligible');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
