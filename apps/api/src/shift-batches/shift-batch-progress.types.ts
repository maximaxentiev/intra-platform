export const BATCH_PROGRESS_70_COMMUNICATION_TYPE = 'batch_progress_70' as const;

export function buildBatchProgress70IdempotencyKey(batchId: string): string {
  return `batch_progress_70:${batchId}`;
}

export function parseBatchProgress70IdempotencyKey(
  idempotencyKey: string,
): { batchId: string } | null {
  const prefix = 'batch_progress_70:';
  if (!idempotencyKey.startsWith(prefix)) return null;
  const batchId = idempotencyKey.slice(prefix.length);
  return batchId ? { batchId } : null;
}
