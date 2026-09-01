import type { BatchProgressCounts } from './shift-batch-progress.util';

export type BatchConfirmationUiState =
  | 'open'
  | 'ready'
  | 'completed'
  | 'updates_required'
  | 'ready_to_send_updates';

export type BatchConfirmationRevisionRow = {
  requestCompletedAt: Date | string | null;
  confirmationRevision: number;
  pendingChangeRevision: number;
  lastConfirmationScheduledAt?: Date | string | null;
};

export function isBatchConfirmationStale(row: BatchConfirmationRevisionRow): boolean {
  return row.requestCompletedAt != null && row.pendingChangeRevision > 0;
}

export function isBatchCentreConfirmationCurrent(row: BatchConfirmationRevisionRow): boolean {
  return row.requestCompletedAt != null && row.pendingChangeRevision === 0;
}

export function deriveBatchConfirmationUiState(
  row: BatchConfirmationRevisionRow,
  progress: BatchProgressCounts,
): BatchConfirmationUiState {
  if (!row.requestCompletedAt) {
    if (progress.activeTotal > 0 && progress.fulfilledCount === progress.activeTotal) {
      return 'ready';
    }
    return 'open';
  }

  if (isBatchConfirmationStale(row)) {
    if (progress.activeTotal > 0 && progress.fulfilledCount === progress.activeTotal) {
      return 'ready_to_send_updates';
    }
    return 'updates_required';
  }

  return 'completed';
}

/** Centre child emails are always consolidated at Batch level for batch children. */
export function isBatchChildCentreCommunicationDeferred(batchId: string | null): boolean {
  return batchId != null;
}
