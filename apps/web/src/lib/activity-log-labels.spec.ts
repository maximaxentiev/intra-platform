import { describe, expect, it } from "vitest";
import {
  activityLogResultRange,
  resolveActivityLogPageSize,
  ACTIVITY_LOG_DEFAULT_PAGE_SIZE,
  ACTIVITY_LOG_PAGE_SIZE_OPTIONS,
} from "./activity-log-labels";

describe("activity log labels", () => {
  it("defaults page size to 10", () => {
    expect(ACTIVITY_LOG_DEFAULT_PAGE_SIZE).toBe(10);
    expect(resolveActivityLogPageSize(undefined)).toBe(10);
  });

  it("offers 10, 25, and 50 page sizes", () => {
    expect([...ACTIVITY_LOG_PAGE_SIZE_OPTIONS]).toEqual([10, 25, 50]);
    expect(resolveActivityLogPageSize(25)).toBe(25);
    expect(resolveActivityLogPageSize(99)).toBe(10);
  });

  it("computes result range without 1–0 of 0", () => {
    expect(activityLogResultRange({ page: 1, pageSize: 10, totalCount: 0 })).toEqual({
      start: 0,
      end: 0,
      totalPages: 0,
    });
    expect(activityLogResultRange({ page: 1, pageSize: 10, totalCount: 87 })).toEqual({
      start: 1,
      end: 10,
      totalPages: 9,
    });
    expect(activityLogResultRange({ page: 9, pageSize: 10, totalCount: 87 })).toEqual({
      start: 81,
      end: 87,
      totalPages: 9,
    });
  });
});
