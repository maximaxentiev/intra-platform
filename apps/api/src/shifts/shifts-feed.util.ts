import type { BatchConfirmationUiState } from '../shift-batches/shift-batch-confirmation-state.util';
import { deriveBatchConfirmationUiState } from '../shift-batches/shift-batch-confirmation-state.util';

export type ShiftFeedChildSummary = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  status: string;
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
};

export type BatchFeedProgress = {
  activeChildCount: number;
  fulfilledChildCount: number;
  cancelledChildCount: number;
};

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

export function hasShiftFeedLevelFilters(input: {
  staffId?: string;
  status?: string;
  from?: string;
  to?: string;
  staffpoint?: 'yes' | 'no';
}): boolean {
  return Boolean(input.staffId || input.status || input.from || input.to || input.staffpoint);
}

export function computeBatchFeedProgress(children: ShiftFeedChildSummary[]): BatchFeedProgress {
  const cancelledChildCount = children.filter((child) => child.status === 'cancelled').length;
  const active = children.filter((child) => child.status !== 'cancelled');
  const fulfilledChildCount = active.filter(
    (child) => child.status === 'filled' || child.status === 'completed',
  ).length;

  return {
    activeChildCount: active.length,
    fulfilledChildCount,
    cancelledChildCount,
  };
}

export type BatchFeedDisplayState = BatchConfirmationUiState;

export function deriveBatchFeedDisplayState(
  batch: {
    requestCompletedAt: Date | null;
    confirmationRevision?: number;
    pendingChangeRevision?: number;
    lastConfirmationScheduledAt?: Date | null;
    cancelledAt?: Date | null;
  },
  progress: BatchFeedProgress,
): BatchFeedDisplayState {
  return deriveBatchConfirmationUiState(
    {
      requestCompletedAt: batch.requestCompletedAt,
      confirmationRevision: batch.confirmationRevision ?? 0,
      pendingChangeRevision: batch.pendingChangeRevision ?? 0,
      lastConfirmationScheduledAt: batch.lastConfirmationScheduledAt ?? null,
      cancelledAt: batch.cancelledAt ?? null,
    },
    {
      activeTotal: progress.activeChildCount,
      fulfilledCount: progress.fulfilledChildCount,
      cancelledCount: progress.cancelledChildCount,
      percentage:
        progress.activeChildCount > 0
          ? Math.round((progress.fulfilledChildCount / progress.activeChildCount) * 100)
          : 0,
    },
  );
}

/** Includes cancelled children in the historical date span. */
export function formatBatchFeedDateRange(children: ShiftFeedChildSummary[]): string | null {
  if (!children.length) return null;
  const dates = [...new Set(children.map((child) => child.shiftDate))].sort();
  if (dates.length === 1) return dates[0] ?? null;
  return `${dates[0]} – ${dates[dates.length - 1]}`;
}

export function compareFeedItems(
  a: { sortDate: string; sortTime: string; createdAt: Date; id: string },
  b: { sortDate: string; sortTime: string; createdAt: Date; id: string },
): number {
  const dateCmp = b.sortDate.localeCompare(a.sortDate);
  if (dateCmp !== 0) return dateCmp;
  const timeCmp = b.sortTime.localeCompare(a.sortTime);
  if (timeCmp !== 0) return timeCmp;
  const createdCmp = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdCmp !== 0) return createdCmp;
  return a.id.localeCompare(b.id);
}

export function sortFeedChildren(children: ShiftFeedChildSummary[]): ShiftFeedChildSummary[] {
  return [...children].sort((a, b) => {
    const dateCmp = a.shiftDate.localeCompare(b.shiftDate);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });
}

export function childMatchesFeedFilters(
  child: ShiftFeedChildSummary,
  filters: {
    staffId?: string;
    status?: string;
    from?: string;
    to?: string;
    staffpoint?: 'yes' | 'no';
  },
): boolean {
  if (filters.staffId && child.assignedStaffId !== filters.staffId) return false;
  if (filters.status && child.status !== filters.status) return false;
  if (filters.from && child.shiftDate < filters.from) return false;
  if (filters.to && child.shiftDate > filters.to) return false;
  if (filters.staffpoint === 'yes' && !child.addedToStaffpoint) return false;
  if (filters.staffpoint === 'no' && child.addedToStaffpoint) return false;
  return true;
}
