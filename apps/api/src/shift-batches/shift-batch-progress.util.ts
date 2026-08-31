export type BatchProgressCounts = {
  activeTotal: number;
  fulfilledCount: number;
  cancelledCount: number;
  percentage: number;
};

export function computeBatchProgressCounts(
  children: ReadonlyArray<{ status: string }>,
): BatchProgressCounts {
  const cancelledCount = children.filter((child) => child.status === 'cancelled').length;
  const active = children.filter((child) => child.status !== 'cancelled');
  const fulfilledCount = active.filter(
    (child) => child.status === 'filled' || child.status === 'completed',
  ).length;
  const activeTotal = active.length;
  const percentage = activeTotal ? Math.round((fulfilledCount / activeTotal) * 100) : 0;

  return { activeTotal, fulfilledCount, cancelledCount, percentage };
}

/** Eligible when open batch progress is in [70%, 100%). */
export function isBatchProgressEmailEligible(counts: BatchProgressCounts): boolean {
  if (counts.activeTotal <= 0) return false;
  if (counts.fulfilledCount >= counts.activeTotal) return false;
  return counts.percentage >= 70;
}
