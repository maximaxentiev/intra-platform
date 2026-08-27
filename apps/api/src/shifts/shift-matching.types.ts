import type { ShiftEligibilityReason } from './shift-matching.util';

export type { ShiftEligibilityReason };

export type ShiftMatchingTarget = {
  id: string;
  centreId: string;
  centreCity: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
};

export type SameDayStaffShift = {
  id: string;
  assignedStaffId: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'filled' | 'cancelled' | 'completed';
};

export type StaffMatchingCandidate = {
  id: string;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
  role: string;
  city: string | null;
  account: {
    status: 'invited' | 'incomplete' | 'active' | 'disabled';
    onboardingCompletedAt: Date | null;
  } | null;
};

export type ShiftEligibilityResult = {
  eligible: boolean;
  reasons: ShiftEligibilityReason[];
};

export type StaffMatchingPriority = {
  group: number;
  label: string;
  isTop: boolean;
  geographicTier: number;
  geographicLabel: string;
  qualificationType: string;
};

export type EligibleAvailableStaffRow = {
  id: string;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
  role: string;
  isTop: boolean;
  contacted: boolean;
  matchingPriority: StaffMatchingPriority;
};

export const SHIFT_ASSIGN_INELIGIBLE_MESSAGE =
  'This staff member is no longer eligible for this shift. Refresh the available staff list and try again.';
