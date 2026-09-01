export const BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE = 'batch_confirmation_final' as const;
export const BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE = 'batch_confirmation_update' as const;

const LEGACY_FINAL_PREFIX = 'batch_confirmation_final:';
const REVISION_PREFIX = 'batch_confirmation:';
const REVISION_SUFFIX = ':revision:';

/** Initial final confirmation (revision 1). */
export function buildBatchConfirmationFinalIdempotencyKey(batchId: string): string {
  return buildBatchConfirmationRevisionIdempotencyKey(batchId, 1);
}

/** Any confirmation revision (initial or update). */
export function buildBatchConfirmationRevisionIdempotencyKey(
  batchId: string,
  revision: number,
): string {
  return `${REVISION_PREFIX}${batchId}${REVISION_SUFFIX}${revision}`;
}

export function parseBatchConfirmationFinalIdempotencyKey(
  idempotencyKey: string,
): { batchId: string; revision: number } | null {
  if (idempotencyKey.startsWith(LEGACY_FINAL_PREFIX)) {
    const batchId = idempotencyKey.slice(LEGACY_FINAL_PREFIX.length);
    return batchId ? { batchId, revision: 1 } : null;
  }

  if (!idempotencyKey.startsWith(REVISION_PREFIX) || !idempotencyKey.includes(REVISION_SUFFIX)) {
    return null;
  }

  const suffixIndex = idempotencyKey.lastIndexOf(REVISION_SUFFIX);
  if (suffixIndex <= REVISION_PREFIX.length) return null;

  const batchId = idempotencyKey.slice(REVISION_PREFIX.length, suffixIndex);
  const revisionRaw = idempotencyKey.slice(suffixIndex + REVISION_SUFFIX.length);
  const revision = Number(revisionRaw);
  if (!batchId || !Number.isInteger(revision) || revision < 1) return null;

  return { batchId, revision };
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
  | { code: 'batch_not_stale'; message: string }
  | { code: 'batch_not_confirmed'; message: string }
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

export type BatchUpdateChangeType =
  | 'carer_changed'
  | 'date_changed'
  | 'time_changed'
  | 'role_changed'
  | 'shift_notes_updated'
  | 'shift_cancelled';

export type BatchUpdateChangeItem = {
  id: string;
  shiftId: string;
  shiftLabel: string;
  type: BatchUpdateChangeType;
  /** Prominent human-readable change line (matches email What changed). */
  label: string;
  /** Full checkbox line including shift context. */
  summary: string;
  previousValue: string | null;
  currentValue: string | null;
  defaultSelected: boolean;
};

export type BatchUpdateReadinessDto = {
  ready: boolean;
  stale: boolean;
  confirmationRevision: number;
  pendingChangeRevision: number;
  primaryContactEmail: string | null;
  activeShiftCount: number;
  fulfilledShiftCount: number;
  detectedChanges: BatchUpdateChangeItem[];
  blockers: BatchCompletionBlocker[];
};
