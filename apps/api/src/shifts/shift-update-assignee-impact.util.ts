import { BadRequestException } from '@nestjs/common';
import type { ShiftMatchingService } from './shift-matching.service';
import type { ShiftEligibilityReason } from './shift-matching.util';
import type { ShiftEligibilityResult } from './shift-matching.types';
import {
  applyShiftUpdatePatch,
  detectShiftCommunicationChanges,
  normalizeShiftCommunicationSnapshot,
  type ShiftCommunicationSnapshot,
} from './shift-update-changes.util';

export type AssigneeImpactStatus = 'eligible' | 'availability_override_available' | 'must_unassign';

export type ShiftAssignmentResolution = 'unassign' | 'availability_override';

export type AssigneeImpactPreview = {
  status: AssigneeImpactStatus;
  staffId: string;
  staffName: string;
  reasons: ShiftEligibilityReason[];
  reasonMessages: string[];
};

const AVAILABILITY_ONLY_REASON: ShiftEligibilityReason = 'not_available';

export const ASSIGNEE_IMPACT_REASON_MESSAGES: Record<ShiftEligibilityReason, string> = {
  not_available: 'Submitted availability does not cover the revised schedule.',
  shift_overlap: 'Another assigned Shift conflicts with the revised schedule.',
  prior_shift_buffer: 'The revised schedule violates the required 2-hour buffer.',
  centre_banned: 'This Staff member is banned at this Centre.',
  no_portal_account: 'This Staff member does not have an active portal account.',
  account_disabled: 'This Staff member portal account is disabled.',
  onboarding_incomplete: 'This Staff member has not completed portal onboarding.',
  documents_ineligible: 'This Staff member does not meet required document compliance.',
  rece_required: 'This Staff member does not meet the RECE requirement.',
  role_mismatch: 'This Staff member does not meet the required role for this Shift.',
};

export function hasScheduleChange(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
): boolean {
  return (
    before.shiftDate !== after.shiftDate ||
    before.startTime !== after.startTime ||
    before.endTime !== after.endTime
  );
}

export function hasRoleChange(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
): boolean {
  return before.roleNeeded !== after.roleNeeded;
}

/** Filled-shift assignee must be revalidated when schedule or role requirements change. */
export function requiresAssigneeRevalidation(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
): boolean {
  return hasScheduleChange(before, after) || hasRoleChange(before, after);
}

export function isAvailabilityOnlyFailure(reasons: readonly ShiftEligibilityReason[]): boolean {
  return reasons.length > 0 && reasons.every((reason) => reason === AVAILABILITY_ONLY_REASON);
}

export function classifyAssigneeImpact(result: ShiftEligibilityResult): AssigneeImpactStatus {
  if (result.eligible) return 'eligible';
  if (isAvailabilityOnlyFailure(result.reasons)) return 'availability_override_available';
  return 'must_unassign';
}

export function reasonMessages(reasons: readonly ShiftEligibilityReason[]): string[] {
  return reasons.map((reason) => ASSIGNEE_IMPACT_REASON_MESSAGES[reason] ?? reason);
}

export async function evaluateAssigneeImpactForProposedUpdate(input: {
  shiftMatching: ShiftMatchingService;
  shiftId: string;
  assignedStaffId: string;
  staffName: string;
  before: ShiftCommunicationSnapshot;
  proposed: Partial<ShiftCommunicationSnapshot>;
}): Promise<AssigneeImpactPreview | null> {
  const after = applyShiftUpdatePatch(input.before, input.proposed);
  if (!requiresAssigneeRevalidation(input.before, after)) return null;

  const result = await input.shiftMatching.evaluateStaffForShift(
    input.shiftId,
    input.assignedStaffId,
    undefined,
    {
      shiftDate: after.shiftDate,
      startTime: after.startTime,
      endTime: after.endTime,
      roleNeeded: after.roleNeeded,
    },
  );

  return {
    status: classifyAssigneeImpact(result),
    staffId: input.assignedStaffId,
    staffName: input.staffName,
    reasons: result.reasons,
    reasonMessages: reasonMessages(result.reasons),
  };
}

export function buildProposedSnapshot(
  before: {
    shiftDate: string | Date;
    startTime: string;
    endTime: string;
    roleNeeded: string | null;
  },
  patch: Partial<ShiftCommunicationSnapshot>,
): ShiftCommunicationSnapshot {
  return applyShiftUpdatePatch(normalizeShiftCommunicationSnapshot(before), patch);
}

export async function assertAssignmentResolutionForUpdate(input: {
  shiftMatching: ShiftMatchingService;
  shiftId: string;
  assignedStaffId: string;
  status: string;
  before: ShiftCommunicationSnapshot;
  after: ShiftCommunicationSnapshot;
  assignmentResolution?: ShiftAssignmentResolution;
}): Promise<{
  shouldUnassign: boolean;
  availabilityOverride: boolean;
  impact: AssigneeImpactPreview | null;
}> {
  if (input.status !== 'filled' || !input.assignedStaffId) {
    if (input.assignmentResolution) {
      throw new BadRequestException('Assignment resolution is not applicable for an unassigned Shift.');
    }
    return { shouldUnassign: false, availabilityOverride: false, impact: null };
  }

  if (!requiresAssigneeRevalidation(input.before, input.after)) {
    if (input.assignmentResolution) {
      throw new BadRequestException(
        'Assignment resolution is not applicable when the Shift schedule and role did not change.',
      );
    }
    return { shouldUnassign: false, availabilityOverride: false, impact: null };
  }

  const result = await input.shiftMatching.evaluateStaffForShift(
    input.shiftId,
    input.assignedStaffId,
    undefined,
    {
      shiftDate: input.after.shiftDate,
      startTime: input.after.startTime,
      endTime: input.after.endTime,
      roleNeeded: input.after.roleNeeded,
    },
  );

  const status = classifyAssigneeImpact(result);
  const impact: AssigneeImpactPreview = {
    status,
    staffId: input.assignedStaffId,
    staffName: '',
    reasons: result.reasons,
    reasonMessages: reasonMessages(result.reasons),
  };

  if (status === 'eligible') {
    if (input.assignmentResolution) {
      throw new BadRequestException(
        'Assignment resolution is not required because the assigned Staff member remains eligible.',
      );
    }
    return { shouldUnassign: false, availabilityOverride: false, impact };
  }

  if (status === 'availability_override_available') {
    if (input.assignmentResolution === 'availability_override') {
      return { shouldUnassign: false, availabilityOverride: true, impact };
    }
    if (input.assignmentResolution === 'unassign') {
      return { shouldUnassign: true, availabilityOverride: false, impact };
    }
    throw new BadRequestException({
      message: 'Assigned Staff is unavailable for the revised schedule.',
      code: 'assignee_impact_required',
      assigneeImpact: impact,
    });
  }

  if (input.assignmentResolution === 'availability_override') {
    throw new BadRequestException({
      message: 'Availability override is not allowed for this assignment conflict.',
      code: 'assignee_override_not_allowed',
      assigneeImpact: impact,
    });
  }

  if (input.assignmentResolution === 'unassign') {
    return { shouldUnassign: true, availabilityOverride: false, impact };
  }

  throw new BadRequestException({
    message: 'Assigned Staff cannot remain on the revised Shift.',
    code: 'assignee_impact_required',
    assigneeImpact: impact,
  });
}

export function detectRelevantCommunicationChanges(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
) {
  return detectShiftCommunicationChanges(before, after);
}
