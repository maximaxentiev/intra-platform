import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveAppliedShiftDetailSearch,
  shiftDetailToSearchParams,
  CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS,
} from "./centre-usage-shift-detail";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("centre-usage-shift-detail", () => {
  it("defaults shift detail status to completed", () => {
    const detail = resolveAppliedShiftDetailSearch({});
    expect(detail.shiftStatus).toBe(CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS);
    expect(detail.shiftPage).toBe(1);
    expect(detail.shiftPageSize).toBe(10);
  });

  it("omits default shift detail params from URL", () => {
    expect(
      shiftDetailToSearchParams({
        shiftStatus: "completed",
        shiftStaffIds: [],
        shiftPage: 1,
        shiftPageSize: 10,
      }),
    ).toEqual({});
  });

  it("persists non-default shift detail params", () => {
    expect(
      shiftDetailToSearchParams({
        shiftStatus: "filled",
        shiftStaffIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddd01"],
        shiftPage: 2,
        shiftPageSize: 25,
      }),
    ).toEqual({
      shiftStatus: "filled",
      shiftStaffIds: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
      shiftPage: 2,
      shiftPageSize: 25,
    });
  });
});

describe("centre usage shift detail UI", () => {
  it("shows shift detail only when centres are explicitly selected", () => {
    const page = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(page).toContain("hasExplicitCentreSelection");
    expect(page).toContain("showShiftDetail");
    expect(page).toContain("CentreUsageShiftDetail");
  });

  it("uses separate shift detail URL params from comparison pagination", () => {
    const page = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(page).toContain("shiftStatus");
    expect(page).toContain("shiftStaffIds");
    expect(page).toContain("shiftPage");
    expect(page).toContain("shiftPageSize");
  });

  it("shift detail component uses scheduled hours terminology only", () => {
    const detail = readSrc("components/reports/CentreUsageShiftDetail.tsx");
    expect(detail).toContain("Scheduled Hours");
    expect(detail).toContain("Shift Detail");
    expect(detail).toContain("Export Shift Detail CSV");
    expect(detail).not.toMatch(/Actual Hours|Hours Worked|Billable Hours|Payroll Hours/i);
  });

  it("hides centre column for single-centre detail table", () => {
    const detail = readSrc("components/reports/CentreUsageShiftDetail.tsx");
    expect(detail).toContain("showCentreColumn = !singleCentreSelected");
  });

  it("registers shift detail export path separately from summary export", () => {
    const exportLib = readSrc("lib/report-export.ts");
    expect(exportLib).toContain('centreUsageShiftDetail: "/reports/centre-usage/shifts/export"');
    expect(exportLib).toContain("shiftPage");
  });
});
