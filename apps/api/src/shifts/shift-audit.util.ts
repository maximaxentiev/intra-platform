import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import {
  PlatformAuditService,
  buildFieldChanges,
  truncateAuditPreview,
} from '../platform-audit/platform-audit.service';

export const SHIFT_AUDIT_FIELDS = [
  'shiftDate',
  'startTime',
  'endTime',
  'centreId',
  'roleNeeded',
  'notes',
  'confirmationNotes',
  'addedToStaffpoint',
] as const;

export type ShiftAuditSnapshot = Record<(typeof SHIFT_AUDIT_FIELDS)[number], unknown>;

export function shiftAuditSnapshot(row: {
  shiftDate: string | Date;
  startTime: string;
  endTime: string;
  centreId: string;
  roleNeeded: string | null;
  notes: string | null;
  shiftConfirmationNotes?: string | null;
  addedToStaffpoint: boolean | null;
}): ShiftAuditSnapshot {
  return {
    shiftDate: String(row.shiftDate),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    centreId: row.centreId,
    roleNeeded: row.roleNeeded ?? '',
    notes: row.notes ?? '',
    confirmationNotes: row.shiftConfirmationNotes ?? null,
    addedToStaffpoint: row.addedToStaffpoint ?? false,
  };
}

export function assignmentAuditAction(
  previousStaffId: string | null,
  newStaffId: string | null,
): typeof PLATFORM_AUDIT_ACTIONS.shiftAssigned | typeof PLATFORM_AUDIT_ACTIONS.shiftUnassigned | typeof PLATFORM_AUDIT_ACTIONS.shiftReassigned | null {
  if (!previousStaffId && newStaffId) return PLATFORM_AUDIT_ACTIONS.shiftAssigned;
  if (previousStaffId && !newStaffId) return PLATFORM_AUDIT_ACTIONS.shiftUnassigned;
  if (previousStaffId && newStaffId && previousStaffId !== newStaffId) {
    return PLATFORM_AUDIT_ACTIONS.shiftReassigned;
  }
  return null;
}

export function buildShiftUpdateMetadata(
  before: ShiftAuditSnapshot,
  after: ShiftAuditSnapshot,
): Record<string, unknown> | undefined {
  const changes = buildFieldChanges(before, after, SHIFT_AUDIT_FIELDS);
  return changes ? { changes } : undefined;
}

export function cancellationReasonPreview(reason: string | null | undefined): string | undefined {
  if (!reason?.trim()) return undefined;
  return truncateAuditPreview(reason);
}
