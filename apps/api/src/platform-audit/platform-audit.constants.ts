export const PLATFORM_AUDIT_ACTOR_TYPES = ['ops_user', 'system'] as const;
export type PlatformAuditActorType = (typeof PLATFORM_AUDIT_ACTOR_TYPES)[number];

export const PLATFORM_AUDIT_ENTITY_TYPES = [
  'shift',
  'centre',
  'user',
  'staff',
  'system',
] as const;
export type PlatformAuditEntityType = (typeof PLATFORM_AUDIT_ENTITY_TYPES)[number];

export const PLATFORM_AUDIT_ACTIONS = {
  shiftCreated: 'shift_created',
  shiftUpdated: 'shift_updated',
  shiftAssigned: 'shift_assigned',
  shiftUnassigned: 'shift_unassigned',
  shiftReassigned: 'shift_reassigned',
  shiftCancelled: 'shift_cancelled',
  shiftCompletedManual: 'shift_completed_manual',
  shiftCompletedAuto: 'shift_completed_auto',
  centreCreated: 'centre_created',
  centreUpdated: 'centre_updated',
  centreDeleted: 'centre_deleted',
  userInvited: 'user_invited',
  userUpdated: 'user_updated',
  staffUpdated: 'staff_updated',
  staffDeleted: 'staff_deleted',
} as const;

export type PlatformAuditAction =
  (typeof PLATFORM_AUDIT_ACTIONS)[keyof typeof PLATFORM_AUDIT_ACTIONS];

const ACTION_ENTITY: Record<PlatformAuditAction, PlatformAuditEntityType> = {
  shift_created: 'shift',
  shift_updated: 'shift',
  shift_assigned: 'shift',
  shift_unassigned: 'shift',
  shift_reassigned: 'shift',
  shift_cancelled: 'shift',
  shift_completed_manual: 'shift',
  shift_completed_auto: 'shift',
  centre_created: 'centre',
  centre_updated: 'centre',
  centre_deleted: 'centre',
  user_invited: 'user',
  user_updated: 'user',
  staff_updated: 'staff',
  staff_deleted: 'staff',
};

export function defaultEntityTypeForAction(action: PlatformAuditAction): PlatformAuditEntityType {
  return ACTION_ENTITY[action];
}

/** Allowed metadata keys for platform audit events. */
export const PLATFORM_AUDIT_METADATA_ALLOWLIST = new Set([
  'changes',
  'previousStaffId',
  'newStaffId',
  'assignedStaffId',
  'cancellationReasonPreview',
  'shiftDate',
  'startTime',
  'endTime',
  'centreName',
  'source',
  'role',
  'isActive',
  'email',
  'name',
]);
