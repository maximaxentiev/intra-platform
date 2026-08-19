/**
 * Fill rate: (filled + completed) / (pending + filled + completed) × 100.
 * Cancelled shifts are excluded from numerator and denominator.
 * Returns null when denominator is zero.
 */
export function computeFillRatePercent(
  filled: number,
  completed: number,
  pending: number,
): number | null {
  const numerator = filled + completed;
  const denominator = pending + filled + completed;
  if (denominator === 0) {
    return null;
  }
  return roundReportPercent((numerator / denominator) * 100);
}

/** One decimal place for report percentages. */
export function roundReportPercent(value: number): number {
  return Math.round(value * 10) / 10;
}
