/** Returns trimmed cancellation reason, or null when blank/whitespace-only. */
export function normalizeCancellationReason(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
