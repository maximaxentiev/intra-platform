export const BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE = 'batch_confirmation_final' as const;

export function buildBatchConfirmationFinalIdempotencyKey(batchId: string): string {
  return `batch_confirmation_final:${batchId}`;
}

export function parseBatchConfirmationFinalIdempotencyKey(
  idempotencyKey: string,
): { batchId: string } | null {
  const prefix = 'batch_confirmation_final:';
  if (!idempotencyKey.startsWith(prefix)) return null;
  const batchId = idempotencyKey.slice(prefix.length);
  return batchId ? { batchId } : null;
}

export type BatchCompletionShiftBlocker = {
  code: 'unfilled_shift' | 'missing_assignee' | 'document_share_unavailable';
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  carerName?: string | null;
  carerStaffId?: string | null;
  message: string;
};

export type BatchCompletionBlocker =
  | { code: 'batch_already_completed'; message: string }
  | { code: 'no_active_shifts'; message: string }
  | BatchCompletionShiftBlocker
  | { code: 'missing_primary_contact'; message: string };

export type BatchCompletionReadinessDto = {
  ready: boolean;
  primaryContactEmail: string | null;
  activeShiftCount: number;
  fulfilledShiftCount: number;
  blockers: BatchCompletionBlocker[];
};

export type BatchFinalConfirmationStatusDto =
  | { state: 'none' }
  | { state: 'scheduled'; scheduledAt: string }
  | { state: 'sending' }
  | { state: 'sent'; sentAt: string }
  | { state: 'failed'; reason: string; canRetry: true };
