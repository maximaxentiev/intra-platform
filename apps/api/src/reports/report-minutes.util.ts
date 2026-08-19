/** Normalize PostgreSQL aggregate minute values to finite non-negative integers. */
export function normalizeReportScheduledMinutes(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid scheduled minutes aggregate: ${String(value)}`);
  }
  return Math.trunc(parsed);
}

/** Normalize PostgreSQL aggregate count values to finite non-negative integers. */
export function normalizeReportCount(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid report count aggregate: ${String(value)}`);
  }
  return Math.trunc(parsed);
}
