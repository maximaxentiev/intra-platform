export type ShiftCancellationRecipient = 'centre' | 'carer';

/** Deterministic cancellation-cycle token from the authoritative transition timestamp. */
export function deriveCancellationVersion(cancelledAt: Date): string {
  return String(cancelledAt.getTime());
}

export function buildShiftCancellationIdempotencyKey(params: {
  shiftId: string;
  cancellationVersion: string;
  recipient: ShiftCancellationRecipient;
}): string {
  return `shift:${params.shiftId}:cancellation:${params.cancellationVersion}:${params.recipient}`;
}

export function parseShiftCancellationIdempotencyKey(key: string): {
  shiftId: string;
  cancellationVersion: string;
  recipient: ShiftCancellationRecipient;
} | null {
  const match = /^shift:([^:]+):cancellation:([^:]+):(centre|carer)$/.exec(key);
  if (!match) return null;
  return {
    shiftId: match[1]!,
    cancellationVersion: match[2]!,
    recipient: match[3] as ShiftCancellationRecipient,
  };
}
