import { BadRequestException } from '@nestjs/common';
import { normalizeShiftRole } from '@intra/shared';
import type { ShiftMatchingService } from './shift-matching.service';
import type { ShiftCommunicationSnapshot } from './shift-update-changes.util';
import { detectShiftCommunicationChanges } from './shift-update-changes.util';

const RECE_ROLE_CHANGE_MESSAGE =
  'The assigned Staff member does not meet the new RECE requirement. Reassign this Shift before changing the role.';

const GENERIC_ROLE_CHANGE_MESSAGE =
  'The assigned Staff member is not compatible with the new role requirement. Reassign this Shift before changing the role.';

export async function assertAssignedStaffCompatibleWithRoleChange(input: {
  shiftMatching: ShiftMatchingService;
  shiftId: string;
  assignedStaffId: string;
  before: ShiftCommunicationSnapshot;
  after: ShiftCommunicationSnapshot;
}): Promise<void> {
  const beforeRole = normalizeShiftRole(input.before.roleNeeded);
  const afterRole = normalizeShiftRole(input.after.roleNeeded);
  if (beforeRole === afterRole) return;

  const result = await input.shiftMatching.evaluateStaffForShift(
    input.shiftId,
    input.assignedStaffId,
    undefined,
    { roleNeeded: input.after.roleNeeded },
  );

  if (result.eligible) return;

  if (afterRole === 'RECE' && result.reasons.includes('rece_required')) {
    throw new BadRequestException(RECE_ROLE_CHANGE_MESSAGE);
  }

  throw new BadRequestException(GENERIC_ROLE_CHANGE_MESSAGE);
}

export function getShiftCommunicationChanges(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
) {
  return detectShiftCommunicationChanges(before, after);
}
