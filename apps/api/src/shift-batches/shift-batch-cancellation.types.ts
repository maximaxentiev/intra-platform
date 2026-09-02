export const BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE = 'batch_cancellation_centre' as const;
export const BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE = 'batch_cancellation_carer' as const;

export type BatchCancellationCase = 'A' | 'B' | 'C';

export type BatchCancellationShiftSummary = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  assignedStaffId: string | null;
  status: string;
};

export function deriveBatchCancellationVersion(cancelledAt: Date): string {
  return String(cancelledAt.getTime());
}

export function buildBatchCancellationCentreIdempotencyKey(params: {
  batchId: string;
  cancellationVersion: string;
}): string {
  return `batch_cancellation:${params.batchId}:${params.cancellationVersion}:centre`;
}

export function buildBatchCancellationCarerIdempotencyKey(params: {
  batchId: string;
  cancellationVersion: string;
  staffId: string;
}): string {
  return `batch_cancellation:${params.batchId}:${params.cancellationVersion}:carer:${params.staffId}`;
}

export function parseBatchCancellationCentreIdempotencyKey(key: string): {
  batchId: string;
  cancellationVersion: string;
} | null {
  const match = /^batch_cancellation:([^:]+):([^:]+):centre$/.exec(key);
  if (!match) return null;
  return { batchId: match[1]!, cancellationVersion: match[2]! };
}

export function parseBatchCancellationCarerIdempotencyKey(key: string): {
  batchId: string;
  cancellationVersion: string;
  staffId: string;
} | null {
  const match = /^batch_cancellation:([^:]+):([^:]+):carer:([^:]+)$/.exec(key);
  if (!match) return null;
  return { batchId: match[1]!, cancellationVersion: match[2]!, staffId: match[3]! };
}

/** Centre has received at least one successful confirmation revision. */
export function hasBatchCentreConfirmation(row: {
  requestCompletedAt: Date | string | null;
  confirmationRevision: number;
}): boolean {
  return row.requestCompletedAt != null && row.confirmationRevision >= 1;
}

export function isBatchChildCancellable(status: string): boolean {
  return status === 'pending' || status === 'filled';
}

export function resolveBatchCancellationCase(
  batch: { requestCompletedAt: Date | string | null; confirmationRevision: number },
  children: BatchCancellationShiftSummary[],
): BatchCancellationCase {
  if (hasBatchCentreConfirmation(batch)) return 'C';
  const hasAssigned = children.some(
    (child) => isBatchChildCancellable(child.status) && child.assignedStaffId,
  );
  return hasAssigned ? 'B' : 'A';
}

export function resolveBatchCancellationRecipients(params: {
  cancelCase: BatchCancellationCase;
  requested?: { centre?: boolean; carer?: boolean } | null;
}): { centre: boolean; carer: boolean } {
  if (params.cancelCase === 'A') {
    return { centre: false, carer: false };
  }
  if (params.cancelCase === 'B') {
    return {
      centre: false,
      carer: params.requested?.carer ?? true,
    };
  }
  return {
    centre: params.requested?.centre ?? false,
    carer: params.requested?.carer ?? false,
  };
}

export type BatchCancellationResultDto = {
  cancelled: true;
  batchId: string;
  cancelledAt: string;
  cancelledChildCount: number;
  scheduledCommunicationIds: string[];
  alreadyCancelled: boolean;
};
