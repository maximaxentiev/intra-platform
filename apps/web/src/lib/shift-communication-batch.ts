export const BATCH_CENTRE_DEFER_MESSAGE =
  "Centre communication is managed through this Batch Request.";

export type ShiftRecipientUnavailableCode =
  | "deferred_open_batch"
  | "document_share_unavailable"
  | "no_centre_email";

export type ShiftRecipientAvailability = {
  available: boolean;
  reason?: string;
  unavailableCode?: ShiftRecipientUnavailableCode;
};

export function applyBatchCentreDeferral(
  availability: ShiftRecipientAvailability,
  centreCommunicationDeferred: boolean | undefined,
): ShiftRecipientAvailability {
  if (!centreCommunicationDeferred) return availability;
  return {
    available: false,
    reason: BATCH_CENTRE_DEFER_MESSAGE,
    unavailableCode: "deferred_open_batch",
  };
}

export function isOpenBatchChild(shift: {
  batchId?: string | null;
  batchRequestCompletedAt?: string | null;
  centreCommunicationDeferred?: boolean;
}): boolean {
  if (shift.centreCommunicationDeferred != null) {
    return shift.centreCommunicationDeferred;
  }
  return !!shift.batchId;
}
