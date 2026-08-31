/**
 * Centre & Shift Performance fill rate.
 * Pending excluded. Denominator = filled + completed + cancelled.
 */
export function computeCentreReportFillRatePercent(
  filledStatusCount: number,
  completedStatusCount: number,
  cancelledStatusCount: number,
): number | null {
  const numerator = filledStatusCount + completedStatusCount;
  const denominator = numerator + cancelledStatusCount;
  if (denominator === 0) {
    return null;
  }
  return roundReportPercent((numerator / denominator) * 100);
}

/** Combined filled metric (filled + completed statuses) for summary rollups. */
export function computeCentreReportFillRateFromCombined(
  combinedFilledCount: number,
  cancelledStatusCount: number,
): number | null {
  const denominator = combinedFilledCount + cancelledStatusCount;
  if (denominator === 0) {
    return null;
  }
  return roundReportPercent((combinedFilledCount / denominator) * 100);
}

/**
 * Dashboard next-7-days fill rate: (filled + completed) / (pending + filled + completed).
 * Cancelled shifts are excluded from numerator and denominator.
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
