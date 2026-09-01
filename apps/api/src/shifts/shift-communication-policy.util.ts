import type { ShiftAssignmentRecipientResult } from './dto/shift-assignment.dto';

export const SHIFT_COMMUNICATION_DEFER_REASON = {
  batchCentreConsolidated: 'deferred_batch_confirmation',
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
  batchConfirmationStale: boolean;
  centreCommunicationDeferred: boolean;
  centreDeferReason: ShiftCommunicationDeferReason | null;
};

export function resolveShiftCommunicationPolicyFromRow(row: {
  batchId: string | null;
  requestCompletedAt?: Date | string | null;
  pendingChangeRevision?: number;
}): ShiftCommunicationPolicy {
  const batchId = row.batchId ?? null;
  const batchRequestCompleted = row.requestCompletedAt != null;
  const batchConfirmationStale =
    batchRequestCompleted && (row.pendingChangeRevision ?? 0) > 0;
  const centreCommunicationDeferred = batchId != null;

  return {
    batchId,
    batchRequestCompleted,
    batchConfirmationStale,
    centreCommunicationDeferred,
    centreDeferReason: centreCommunicationDeferred
      ? SHIFT_COMMUNICATION_DEFER_REASON.batchCentreConsolidated
      : null,
  };
}

export function centreDeferredRecipientResult(): ShiftAssignmentRecipientResult {
  return {
    attempted: false,
    sent: false,
    deferred: true,
    skippedReason: SHIFT_COMMUNICATION_DEFER_REASON.batchCentreConsolidated,
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
