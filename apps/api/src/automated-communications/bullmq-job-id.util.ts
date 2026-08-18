import { createHash } from 'node:crypto';

const JOB_ID_PREFIX = 'comm-';

/**
 * Derive a deterministic BullMQ-safe job ID from a PostgreSQL idempotency key.
 * BullMQ custom IDs must not contain ':' and should not be digits-only.
 */
export function deriveBullMqJobId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey, 'utf8').digest('hex');
  return `${JOB_ID_PREFIX}${digest.slice(0, 40)}`;
}

/** Provider idempotency key for Resend (<= 256 chars). */
export function deriveProviderIdempotencyKey(scheduledCommunicationId: string): string {
  return `intra-comm-${scheduledCommunicationId}`;
}
