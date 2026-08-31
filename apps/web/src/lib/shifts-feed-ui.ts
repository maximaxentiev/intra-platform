import { formatShiftDateLabel } from '@/lib/shifts-list-ui';
import type { ShiftFeedBatchItem } from '@/lib/db';

export function formatBatchFeedDateLabel(dateRange: string | null): string {
  if (!dateRange) return 'No dates yet';
  if (!dateRange.includes(' – ')) return formatShiftDateLabel(dateRange);
  const [from, to] = dateRange.split(' – ');
  return `${formatShiftDateLabel(from ?? dateRange)} – ${formatShiftDateLabel(to ?? dateRange)}`;
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
