/**
 * Canonical rotation epoch for staff document share tokens.
 *
 * Always derive from persisted document_share_token_created_at as UTC epoch milliseconds.
 * Do not format timestamps independently at call sites.
 */

export function shareTokenRotationEpoch(createdAt: Date): number {
  const epoch = createdAt.getTime();
  if (Number.isNaN(epoch)) {
    throw new Error('Invalid share token rotation timestamp.');
  }
  return epoch;
}

export function shareTokenRotationEpochFromPersisted(
  createdAt: Date | string | null | undefined,
): number | null {
  if (createdAt == null) {
    return null;
  }
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const epoch = date.getTime();
  if (Number.isNaN(epoch)) {
    return null;
  }
  return epoch;
}

/**
 * Returns the next rotation timestamp strictly after any previous epoch.
 * Guarantees a different token even when the system clock matches the prior millisecond.
 */
export function nextShareTokenRotationCreatedAt(
  previousCreatedAt: Date | null | undefined,
  nowMs: number = Date.now(),
): Date {
  if (previousCreatedAt == null) {
    return new Date(nowMs);
  }
  const previousEpoch = shareTokenRotationEpoch(previousCreatedAt);
  const nextEpoch = Math.max(nowMs, previousEpoch + 1);
  return new Date(nextEpoch);
}
