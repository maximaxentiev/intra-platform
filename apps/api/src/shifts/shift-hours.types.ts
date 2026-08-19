export type ShiftHoursAdjustmentSource = 'centre' | 'ops';

export function buildOpsOverrideIdempotencyKey(params: {
  shiftId: string;
  actorUserId: string;
  clientKey: string;
}): string {
  const key = params.clientKey.trim();
  return `shift-hours:ops:${params.shiftId}:${params.actorUserId}:${key}`;
}

export function buildCentreSubmissionIdempotencyKey(params: {
  shiftId: string;
  clientKey: string;
}): string {
  const key = params.clientKey.trim();
  return `shift-hours:centre:${params.shiftId}:${key}`;
}

/** Future Phase 8D communication idempotency keys. */
export function buildShiftHoursAdjustedCommunicationKey(params: {
  shiftId: string;
  adjustmentId: string;
  recipient: 'centre' | 'carer';
}): string {
  return `shift:${params.shiftId}:hours-adjustment:${params.adjustmentId}:${params.recipient}`;
}
