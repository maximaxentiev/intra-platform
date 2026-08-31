import type { ShiftAssignmentRecipientResult } from './dto/shift-assignment.dto';

export const SHIFT_COMMUNICATION_DEFER_REASON = {
  openBatchCentreDeferred: 'deferred_batch_confirmation',
} as const;

export type ShiftCommunicationDeferReason =
  (typeof SHIFT_COMMUNICATION_DEFER_REASON)[keyof typeof SHIFT_COMMUNICATION_DEFER_REASON];

export const BATCH_CENTRE_DEFER_MESSAGE =
  'Centre communication is managed through this Batch Request.';

export type ShiftCommunicationUnavailableCode =
  | 'deferred_open_batch'
  | 'document_share_unavailable'
  | 'no_centre_primary_contact'
  | 'no_centre_email'
  | 'invalid_centre_email'
  | 'email_not_configured';

export type ShiftRecipientAvailability = {
  available: boolean;
  reason?: string;
  unavailableCode?: ShiftCommunicationUnavailableCode;
};

export type ShiftCommunicationPolicy = {
  batchId: string | null;
  batchRequestCompleted: boolean;
  centreCommunicationDeferred: boolean;
  centreDeferReason: ShiftCommunicationDeferReason | null;
};

export function resolveShiftCommunicationPolicyFromRow(row: {
  batchId: string | null;
  requestCompletedAt: Date | string | null;
}): ShiftCommunicationPolicy {
  const batchId = row.batchId ?? null;
  const batchRequestCompleted = row.requestCompletedAt != null;
  const centreCommunicationDeferred = batchId != null && !batchRequestCompleted;

  return {
    batchId,
    batchRequestCompleted,
    centreCommunicationDeferred,
    centreDeferReason: centreCommunicationDeferred
      ? SHIFT_COMMUNICATION_DEFER_REASON.openBatchCentreDeferred
      : null,
  };
}

export function centreDeferredRecipientResult(): ShiftAssignmentRecipientResult {
  return {
    attempted: false,
    sent: false,
    deferred: true,
    skippedReason: SHIFT_COMMUNICATION_DEFER_REASON.openBatchCentreDeferred,
  };
}

export function centreDeferredAvailability(): ShiftRecipientAvailability {
  return {
    available: false,
    reason: BATCH_CENTRE_DEFER_MESSAGE,
    unavailableCode: 'deferred_open_batch',
  };
}

export function applyCentreBatchDeferral<T extends ShiftRecipientAvailability>(
  availability: T,
  policy: ShiftCommunicationPolicy,
): T | ShiftRecipientAvailability {
  if (!policy.centreCommunicationDeferred) return availability;
  return centreDeferredAvailability();
}
