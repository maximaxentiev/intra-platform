import { BadRequestException } from '@nestjs/common';
import { isActiveShiftRole, normalizeShiftRole } from '@intra/shared';

const LEGACY_NANNY_TO_ACTIVE_MESSAGE =
  'Nanny is a legacy shift role and cannot be assigned to active shifts.';

/** Reject Nanny and other non-active roles on new Shift creation. */
export function assertActiveShiftRoleForCreate(roleNeeded: string | undefined): void {
  if (roleNeeded === undefined || roleNeeded.trim() === '') {
    return;
  }

  const normalized = normalizeShiftRole(roleNeeded);
  if (normalized === 'Nanny') {
    throw new BadRequestException(LEGACY_NANNY_TO_ACTIVE_MESSAGE);
  }
  if (!isActiveShiftRole(normalized)) {
    throw new BadRequestException('Shift role must be ECA, ECE, or RECE.');
  }
}

/**
 * Allow legacy Nanny to remain Nanny, or be upgraded to ECA/ECE/RECE.
 * Active shifts may switch among ECA/ECE/RECE but must not become Nanny.
 */
export function assertShiftRoleUpdateAllowed(
  existingRoleNeeded: string | null | undefined,
  nextRoleNeeded: string | undefined,
): void {
  if (nextRoleNeeded === undefined) {
    return;
  }

  const existing = normalizeShiftRole(existingRoleNeeded);
  const next = normalizeShiftRole(nextRoleNeeded);

  if (next === 'Nanny') {
    if (existing !== 'Nanny') {
      throw new BadRequestException(LEGACY_NANNY_TO_ACTIVE_MESSAGE);
    }
    return;
  }

  if (next != null && !isActiveShiftRole(next)) {
    throw new BadRequestException('Shift role must be ECA, ECE, or RECE.');
  }
}
