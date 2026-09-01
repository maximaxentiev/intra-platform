import { describe, expect, it } from 'vitest';
import {
  childMatchesFeedFilters,
  compareFeedItems,
  computeBatchFeedProgress,
  deriveBatchFeedDisplayState,
  formatBatchFeedDateRange,
  hasShiftFeedLevelFilters,
  resolveShiftFeedPageSize,
  sortFeedChildren,
  type ShiftFeedChildSummary,
} from './shifts-feed.util';

const child = (overrides: Partial<ShiftFeedChildSummary>): ShiftFeedChildSummary => ({
  id: overrides.id ?? '1',
  shiftDate: overrides.shiftDate ?? '2026-09-01',
  startTime: overrides.startTime ?? '08:00:00',
  endTime: overrides.endTime ?? '16:00:00',
  roleNeeded: overrides.roleNeeded ?? 'ECE',
  addedToStaffpoint: overrides.addedToStaffpoint ?? false,
  status: overrides.status ?? 'pending',
  assignedStaffId: overrides.assignedStaffId ?? null,
  assignedLegalName: overrides.assignedLegalName ?? null,
  assignedDisplayName: overrides.assignedDisplayName ?? null,
  assignedUseDisplayName: overrides.assignedUseDisplayName ?? null,
});

describe('shift feed pagination defaults', () => {
  it('defaults to 25 rows per page', () => {
    expect(resolveShiftFeedPageSize(undefined)).toBe(25);
    expect(resolveShiftFeedPageSize(999)).toBe(25);
  });

  it('accepts supported page sizes', () => {
    expect(resolveShiftFeedPageSize(100)).toBe(100);
  });
});

describe('batch feed progress', () => {
  it('excludes cancelled from denominator and counts filled/completed as fulfilled', () => {
    const progress = computeBatchFeedProgress([
      child({ status: 'filled' }),
      child({ id: '2', status: 'completed' }),
      child({ id: '3', status: 'pending' }),
      child({ id: '4', status: 'cancelled' }),
    ]);
    expect(progress.activeChildCount).toBe(3);
    expect(progress.fulfilledChildCount).toBe(2);
    expect(progress.cancelledChildCount).toBe(1);
  });
});

describe('batch feed date range', () => {
  it('shows one date when all children share it', () => {
    expect(
      formatBatchFeedDateRange([
        child({ shiftDate: '2026-09-05' }),
        child({ id: '2', shiftDate: '2026-09-05', status: 'cancelled' }),
      ]),
    ).toBe('2026-09-05');
  });

  it('shows a range across multiple dates including cancelled children', () => {
    expect(
      formatBatchFeedDateRange([
        child({ shiftDate: '2026-09-07' }),
        child({ id: '2', shiftDate: '2026-09-11' }),
        child({ id: '3', shiftDate: '2026-09-09', status: 'cancelled' }),
      ]),
    ).toBe('2026-09-07 – 2026-09-11');
  });
});

describe('batch feed display state', () => {
  it('derives open, ready, and completed states', () => {
    const full = computeBatchFeedProgress([
      child({ status: 'filled' }),
      child({ id: '2', status: 'completed' }),
    ]);
    expect(deriveBatchFeedDisplayState({ requestCompletedAt: null }, full)).toBe('ready');
    expect(
      deriveBatchFeedDisplayState({ requestCompletedAt: new Date(), pendingChangeRevision: 0 }, full),
    ).toBe('completed');
    const open = computeBatchFeedProgress([child({ status: 'pending' })]);
    expect(deriveBatchFeedDisplayState({ requestCompletedAt: null }, open)).toBe('open');
  });

  it('derives stale update states from pending change revision', () => {
    const full = computeBatchFeedProgress([
      child({ status: 'filled' }),
      child({ id: '2', status: 'filled' }),
    ]);
    const partial = computeBatchFeedProgress([
      child({ status: 'filled' }),
      child({ id: '2', status: 'pending' }),
    ]);
    const confirmedAt = new Date('2026-09-01T12:00:00Z');

    expect(
      deriveBatchFeedDisplayState(
        { requestCompletedAt: confirmedAt, pendingChangeRevision: 2 },
        full,
      ),
    ).toBe('ready_to_send_updates');
    expect(
      deriveBatchFeedDisplayState(
        { requestCompletedAt: confirmedAt, pendingChangeRevision: 1 },
        partial,
      ),
    ).toBe('updates_required');
  });
});

describe('feed sorting', () => {
  it('sorts top-level items by date desc then time desc then createdAt desc', () => {
    const sorted = [
      { sortDate: '2026-09-01', sortTime: '08:00:00', createdAt: new Date('2026-01-01'), id: 'a' },
      { sortDate: '2026-09-10', sortTime: '08:00:00', createdAt: new Date('2026-01-01'), id: 'b' },
      { sortDate: '2026-09-10', sortTime: '09:00:00', createdAt: new Date('2026-01-01'), id: 'c' },
    ].sort(compareFeedItems);
    expect(sorted.map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts children chronologically by date then start time then id', () => {
    const sorted = sortFeedChildren([
      child({ id: 'b', shiftDate: '2026-09-02', startTime: '09:00:00' }),
      child({ id: 'a', shiftDate: '2026-09-01', startTime: '17:00:00' }),
      child({ id: 'c', shiftDate: '2026-09-02', startTime: '08:00:00' }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('child filter matching', () => {
  it('matches role/status/date/staff/staffpoint predicates', () => {
    const row = child({
      shiftDate: '2026-09-05',
      roleNeeded: 'ECE',
      status: 'pending',
      assignedStaffId: 'staff-1',
      addedToStaffpoint: true,
    });
    expect(childMatchesFeedFilters(row, { status: 'pending' })).toBe(true);
    expect(childMatchesFeedFilters(row, { status: 'filled' })).toBe(false);
    expect(childMatchesFeedFilters(row, { staffpoint: 'yes' })).toBe(true);
    expect(childMatchesFeedFilters(row, { from: '2026-09-06' })).toBe(false);
    expect(childMatchesFeedFilters(row, { staffId: 'staff-1' })).toBe(true);
  });
});

describe('shift-level filter detection', () => {
  it('treats staffpoint as a shift-level filter', () => {
    expect(hasShiftFeedLevelFilters({ staffpoint: 'yes' })).toBe(true);
    expect(hasShiftFeedLevelFilters({})).toBe(false);
  });
});
