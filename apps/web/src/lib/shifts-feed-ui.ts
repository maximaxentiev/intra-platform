import type { ShiftFeedBatchItem } from '@/lib/db';

function formatCompactDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${month}-${day}-${year}`;
}

/** Compact one-line batch date period for the Shifts feed Date column. */
export function formatBatchFeedDateLabel(dateRange: string | null): string {
  if (!dateRange) return 'No dates yet';
  if (!dateRange.includes(' – ')) return formatCompactDate(dateRange.trim());

  const [fromRaw, toRaw] = dateRange.split(' – ');
  const from = (fromRaw ?? '').trim();
  const to = (toRaw ?? from).trim();
  if (!from) return 'No dates yet';
  if (from === to) return formatCompactDate(from);

  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!fromMatch || !toMatch) return `${from} – ${to}`;

  const fromYear = fromMatch[1];
  const toYear = toMatch[1];
  const fromCompact = `${fromMatch[2]}-${fromMatch[3]}`;
  const toCompact = `${toMatch[2]}-${toMatch[3]}`;

  if (fromYear === toYear) {
    return `${fromCompact} to ${toCompact} ${fromYear}`;
  }
  return `${fromCompact}-${fromYear} to ${toCompact}-${toYear}`;
}

export function formatBatchFeedProgressLabel(batch: ShiftFeedBatchItem): string {
  return `${batch.fulfilledChildCount} of ${batch.activeChildCount} filled`;
}

export function batchFeedStateLabel(state: ShiftFeedBatchItem['batch']['displayState']): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    default:
      return 'Open';
  }
}

export const SHIFT_FEED_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const SHIFT_FEED_DEFAULT_PAGE_SIZE = 25;

export type ShiftFeedPageSize = (typeof SHIFT_FEED_PAGE_SIZE_OPTIONS)[number];

export function resolveShiftFeedPageSize(value?: number): ShiftFeedPageSize {
  if (
    value !== undefined &&
    (SHIFT_FEED_PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  ) {
    return value as ShiftFeedPageSize;
  }
  return SHIFT_FEED_DEFAULT_PAGE_SIZE;
}

export function feedResultCountLabel(totalItems: number): string {
  return `${totalItems} item${totalItems === 1 ? '' : 's'}`;
}

export function batchMatchingChildrenLabel(matchingChildCount: number): string | null {
  if (matchingChildCount <= 0) return null;
  return `${matchingChildCount} matching shift${matchingChildCount === 1 ? '' : 's'}`;
}
