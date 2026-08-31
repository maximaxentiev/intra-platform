import { describe, expect, it } from 'vitest';
import {
  computeBatchProgressCounts,
  isBatchProgressEmailEligible,
} from './shift-batch-progress.util';

describe('computeBatchProgressCounts', () => {
  it('counts fulfilled active children and excludes cancelled from denominator', () => {
    const counts = computeBatchProgressCounts([
      { status: 'filled' },
      { status: 'filled' },
      { status: 'pending' },
      { status: 'cancelled' },
    ]);
    expect(counts).toEqual({
      activeTotal: 3,
      fulfilledCount: 2,
      cancelledCount: 1,
      percentage: 67,
    });
  });

  it('treats completed as fulfilled', () => {
    const counts = computeBatchProgressCounts([
      { status: 'completed' },
      { status: 'filled' },
      { status: 'pending' },
    ]);
    expect(counts.fulfilledCount).toBe(2);
    expect(counts.percentage).toBe(67);
  });
});

describe('isBatchProgressEmailEligible', () => {
  it('is not eligible at 60%', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 10,
        fulfilledCount: 6,
        cancelledCount: 0,
        percentage: 60,
      }),
    ).toBe(false);
  });

  it('is eligible at 70%', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 10,
        fulfilledCount: 7,
        cancelledCount: 0,
        percentage: 70,
      }),
    ).toBe(true);
  });

  it('is not eligible at 100%', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 10,
        fulfilledCount: 10,
        cancelledCount: 0,
        percentage: 100,
      }),
    ).toBe(false);
  });

  it('is not eligible for small batch jumping to 100%', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 3,
        fulfilledCount: 3,
        cancelledCount: 0,
        percentage: 100,
      }),
    ).toBe(false);
  });

  it('is eligible after cancellation changes denominator to 75%', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 8,
        fulfilledCount: 6,
        cancelledCount: 2,
        percentage: 75,
      }),
    ).toBe(true);
  });

  it('is not eligible with zero active children', () => {
    expect(
      isBatchProgressEmailEligible({
        activeTotal: 0,
        fulfilledCount: 0,
        cancelledCount: 5,
        percentage: 0,
      }),
    ).toBe(false);
  });
});
