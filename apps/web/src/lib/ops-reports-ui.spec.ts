import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { currentTorontoMonthRange } from "./reports-dates";
import { formatReportFillRatePercent } from "./ops-report-formatters";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("ops reports UI source", () => {
  it("includes Reports navigation after Dashboard", () => {
    const shell = readSrc("components/AppShell.tsx");
    expect(shell).toContain('to: "/reports"');
    expect(shell).toContain('label: "Reports"');
    const dashboardIdx = shell.indexOf('to: "/dashboard"');
    const reportsIdx = shell.indexOf('to: "/reports"');
    expect(reportsIdx).toBeGreaterThan(dashboardIdx);
  });

  it("landing page shows five cards with only two enabled", () => {
    const landing = readSrc("routes/_authenticated/reports.index.tsx");
    expect(landing).toContain("Shift Fulfillment");
    expect(landing).toContain("Centre Usage");
    expect(landing).toContain("Staff Usage");
    expect(landing).toContain("Document Compliance");
    expect(landing).toContain("Activity Log");
    expect(landing).toContain("Coming soon");
    expect(landing).not.toContain("/reports/staff-usage");
    expect(landing).not.toContain("Applications");
  });

  it("uses scheduled hours labels and forbids actual/worked hours wording", () => {
    const centreUsage = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(centreUsage).toContain("Scheduled Hours");
    expect(centreUsage).toContain("REPORT_SCHEDULED_HOURS_LABEL");
    expect(centreUsage).not.toMatch(/Actual Hours|Hours Worked|Verified Hours|Payroll Hours/i);
  });

  it("renders null fill rate as em dash", () => {
    expect(formatReportFillRatePercent(null)).toBe("—");
  });

  it("centre usage page includes mobile card layout", () => {
    const centreUsage = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(centreUsage).toContain("lg:hidden");
    expect(centreUsage).toContain("hidden lg:block");
  });

  it("shift fulfillment page persists filters in URL search params", () => {
    const page = readSrc("routes/_authenticated/reports.shift-fulfillment.tsx");
    expect(page).toContain("validateSearch");
    expect(page).toContain("dateFrom");
    expect(page).toContain("centreId");
  });
});

describe("reports date defaults", () => {
  it("returns a full Toronto calendar month", () => {
    const range = currentTorontoMonthRange();
    expect(range.dateFrom.endsWith("-01")).toBe(true);
    expect(range.dateFrom.slice(0, 7)).toBe(range.dateTo.slice(0, 7));
  });
});
