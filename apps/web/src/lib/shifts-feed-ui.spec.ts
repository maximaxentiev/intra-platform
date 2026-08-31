import { describe, expect, it } from 'vitest';
import type { ShiftFeedBatchItem, ShiftFeedItem } from '@/lib/db';
import { formatBatchFeedDateLabel, formatBatchFeedProgressLabel } from './shifts-feed-ui';

describe('batch feed display labels', () => {
  it('formats progress as fulfilled over active children', () => {
    const batch: ShiftFeedBatchItem = {
      type: 'batch',
      batch: {
        id: 'b1',
        centreId: 'c1',
        centreName: 'Centre',
        requestCompletedAt: null,
        dateRange: '2026-09-07 – 2026-09-11',
        displayState: 'open',
      },
      matchingChildren: [],
      totalChildCount: 15,
      activeChildCount: 15,
      fulfilledChildCount: 12,
      cancelledChildCount: 0,
      matchingChildCount: 0,
    };
    expect(formatBatchFeedProgressLabel(batch)).toBe('12 of 15 filled');
  });

  it('formats single-date and ranged batch labels', () => {
    expect(formatBatchFeedDateLabel('2026-09-07')).toBe('Sep 7');
    expect(formatBatchFeedDateLabel('2026-09-07 – 2026-09-11')).toBe('Sep 7 – Sep 11');
  });
});

describe('feed item discrimination', () => {
  it('distinguishes shift and batch feed items', () => {
    const shiftItem: ShiftFeedItem = {
      type: 'shift',
      shift: {
        id: 's1',
        centreId: 'c1',
        centreName: 'Centre',
        shiftDate: '2026-09-01',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECE',
        addedToStaffpoint: false,
        status: 'pending',
        assignedStaffId: null,
        assignedLegalName: null,
        assignedDisplayName: null,
        assignedUseDisplayName: null,
      },
    };
    expect(shiftItem.type).toBe('shift');
  });
});
