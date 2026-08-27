import { BadRequestException } from '@nestjs/common';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
  normalizeShiftRoleNeeded,
} from './shift-assignment-display.util';

export type ShiftCommunicationField = 'date' | 'time' | 'role';

export type ShiftCommunicationChange = {
  field: ShiftCommunicationField;
  label: string;
  beforeDisplay: string;
  afterDisplay: string;
  beforeValue: string;
  afterValue: string;
};

export type ShiftCommunicationSnapshot = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
};

export function normalizeShiftCommunicationSnapshot(row: {
  shiftDate: string | Date;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
}): ShiftCommunicationSnapshot {
  return {
    shiftDate: String(row.shiftDate),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    roleNeeded: row.roleNeeded ?? '',
  };
}

export function applyShiftUpdatePatch(
  before: ShiftCommunicationSnapshot,
  patch: Partial<ShiftCommunicationSnapshot>,
): ShiftCommunicationSnapshot {
  return {
    shiftDate: patch.shiftDate ?? before.shiftDate,
    startTime: patch.startTime ?? before.startTime,
    endTime: patch.endTime ?? before.endTime,
    roleNeeded: patch.roleNeeded ?? before.roleNeeded,
  };
}

export function detectShiftCommunicationChanges(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
): ShiftCommunicationChange[] {
  const changes: ShiftCommunicationChange[] = [];

  if (before.shiftDate !== after.shiftDate) {
    changes.push({
      field: 'date',
      label: 'Date',
      beforeDisplay: formatShiftAssignmentDateLabel(before.shiftDate),
      afterDisplay: formatShiftAssignmentDateLabel(after.shiftDate),
      beforeValue: before.shiftDate,
      afterValue: after.shiftDate,
    });
  }

  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    changes.push({
      field: 'time',
      label: 'Time',
      beforeDisplay: formatShiftAssignmentTimeRange(before.startTime, before.endTime),
      afterDisplay: formatShiftAssignmentTimeRange(after.startTime, after.endTime),
      beforeValue: `${before.startTime}|${before.endTime}`,
      afterValue: `${after.startTime}|${after.endTime}`,
    });
  }

  const beforeRole = normalizeShiftRoleNeeded(before.roleNeeded) ?? '';
  const afterRole = normalizeShiftRoleNeeded(after.roleNeeded) ?? '';
  if (beforeRole !== afterRole) {
    changes.push({
      field: 'role',
      label: 'Role required',
      beforeDisplay: beforeRole || '—',
      afterDisplay: afterRole || '—',
      beforeValue: beforeRole,
      afterValue: afterRole,
    });
  }

  return changes;
}

export function hasShiftCommunicationChanges(changes: readonly ShiftCommunicationChange[]): boolean {
  return changes.length > 0;
}

export function formatShiftChangeArrow(change: ShiftCommunicationChange): string {
  return `${change.beforeDisplay} → ${change.afterDisplay}`;
}

export type ShiftUpdateCommunicationInclude = Partial<Record<ShiftCommunicationField, boolean>>;

export type ValidatedShiftUpdateCommunications = {
  centre?: { recipientEmail: string; include: ShiftCommunicationField[] };
  carer?: { recipientEmail: string; include: ShiftCommunicationField[] };
};

export function validateShiftUpdateCommunicationsInput(input: {
  changes: readonly ShiftCommunicationChange[];
  communications?: {
    centre?: { send?: boolean; include?: ShiftUpdateCommunicationInclude };
    carer?: { send?: boolean; include?: ShiftUpdateCommunicationInclude };
  };
}): ValidatedShiftUpdateCommunications | null {
  if (!input.communications) return null;

  const changedFields = new Set(input.changes.map((change) => change.field));
  const result: ValidatedShiftUpdateCommunications = {};

  if (input.communications.centre?.send) {
    assertOnlyChangedFieldsIncluded(input.communications.centre.include, changedFields);
    const include = resolveIncludedFields(input.communications.centre.include, changedFields);
    if (include.length === 0) {
      throw new BadRequestException('Centre communication must include at least one changed field.');
    }
    result.centre = { recipientEmail: '', include };
  }

  if (input.communications.carer?.send) {
    assertOnlyChangedFieldsIncluded(input.communications.carer.include, changedFields);
    const include = resolveIncludedFields(input.communications.carer.include, changedFields);
    if (include.length === 0) {
      throw new BadRequestException('Carer communication must include at least one changed field.');
    }
    result.carer = { recipientEmail: '', include };
  }

  return Object.keys(result).length > 0 ? result : null;
}

function assertOnlyChangedFieldsIncluded(
  include: ShiftUpdateCommunicationInclude | undefined,
  changedFields: Set<ShiftCommunicationField>,
) {
  if (!include) return;
  for (const field of ['date', 'time', 'role'] as const) {
    if (include[field] && !changedFields.has(field)) {
      throw new BadRequestException(
        `Communication cannot include ${field} because it did not change.`,
      );
    }
  }
}

function resolveIncludedFields(
  include: ShiftUpdateCommunicationInclude | undefined,
  changedFields: Set<ShiftCommunicationField>,
): ShiftCommunicationField[] {
  const selected: ShiftCommunicationField[] = [];
  for (const field of ['date', 'time', 'role'] as const) {
    if (!changedFields.has(field)) continue;
    if (include?.[field]) selected.push(field);
  }
  return selected;
}
