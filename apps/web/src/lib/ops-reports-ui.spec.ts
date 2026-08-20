import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { currentTorontoMonthRange } from "./reports-dates";
import { formatReportFillRatePercent, formatReportDurationMinutes } from "./ops-report-formatters";

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

  it("landing page shows five cards with five enabled reports", () => {
    const landing = readSrc("routes/_authenticated/reports.index.tsx");
    expect(landing).toContain("Shift Fulfillment");
    expect(landing).toContain("Centre Usage");
    expect(landing).toContain("Staff Usage");
    expect(landing).toContain("Document Compliance");
    expect(landing).toContain("Activity Log");
    expect(landing).toContain('to: "/reports/activity"');
    expect(landing).toMatch(/title: "Activity Log"[\s\S]*available: true/);
    expect(landing).toContain('/reports/documents');
    expect(landing).toContain('/reports/activity');
    expect(landing).not.toContain("Applications");
  });

  it("uses scheduled hours labels and forbids actual/worked hours wording", () => {
    const summaryCards = readSrc("components/reports/CentreUsageSummaryCards.tsx");
    expect(summaryCards).toContain("Scheduled Hours");
    expect(summaryCards).toContain("REPORT_SCHEDULED_HOURS_LABEL");
    const centreUsage = readSrc("routes/_authenticated/reports.centre-usage.tsx");
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

  it("renders zero scheduled minutes without throwing", () => {
    expect(formatReportDurationMinutes(0)).toBe("0m");
  });

  it("centre usage defers duration formatting until report data is ready", () => {
    const summaryCards = readSrc("components/reports/CentreUsageSummaryCards.tsx");
    expect(summaryCards).toContain("ready");
    expect(summaryCards).toContain("formatReportDurationMinutes(summary!.totalScheduledMinutes)");
  });

  it("centre usage includes multi-select centre filter", () => {
    const filters = readSrc("components/reports/CentreUsageFilters.tsx");
    expect(filters).toContain("ReportCentreMultiSelect");
    expect(filters).toContain("Select all");
    expect(filters).toContain("Clear selection");
    expect(filters).toContain('aria-label="Search centres"');
  });

  it("centre usage page hides comparison table for single-centre selection", () => {
    const centreUsage = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(centreUsage).toContain("isSingleCentreSelection");
    expect(centreUsage).toContain("showComparison");
    expect(centreUsage).toContain("centreIds");
  });

  it("centre usage page renders all nine summary cards", () => {
    const summaryCards = readSrc("components/reports/CentreUsageSummaryCards.tsx");
    expect(summaryCards).toContain("Centres Shown");
    expect(summaryCards).toContain("Total Shifts");
    expect(summaryCards).toContain("Fill Rate");
    expect(summaryCards).toContain("Pending");
    expect(summaryCards).toContain("Filled");
    expect(summaryCards).toContain("Completed");
    expect(summaryCards).toContain("Cancelled");
  });

  it("shift fulfillment page uses centre multi-select and pagination", () => {
    const page = readSrc("routes/_authenticated/reports.shift-fulfillment.tsx");
    const filters = readSrc("components/reports/ShiftFulfillmentFilters.tsx");
    expect(page).toContain("validateSearch");
    expect(page).toContain("centreIds");
    expect(page).toContain("ReportPagination");
    expect(page).toContain("isSingleCentreSelection");
    expect(filters).toContain("ReportMoreFiltersSection");
  });

  it("staff usage page uses allowed scheduled-hours labels only", () => {
    const staffUsage = readSrc("routes/_authenticated/reports.staff-usage.tsx");
    const summaryCards = readSrc("components/reports/StaffUsageSummaryCards.tsx");
    expect(summaryCards).toContain("REPORT_SCHEDULED_HOURS_LABEL");
    expect(summaryCards).toContain("REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL");
    expect(staffUsage).not.toMatch(/Actual Hours|Hours Worked|Verified Hours|Payroll Hours/i);
  });

  it("staff usage includes multi-select staff filter and URL state", () => {
    const filters = readSrc("components/reports/StaffUsageFilters.tsx");
    const page = readSrc("routes/_authenticated/reports.staff-usage.tsx");
    expect(filters).toContain("ReportStaffMultiSelect");
    expect(filters).toContain('aria-label="Search staff"');
    expect(page).toContain("staffIds");
    expect(page).toContain("isSingleStaffSelection");
  });

  it("staff usage hides comparison table for single staff and shows drill-down", () => {
    const page = readSrc("routes/_authenticated/reports.staff-usage.tsx");
    expect(page).toContain("showComparison");
    expect(page).toContain("Completed Shifts");
    expect(page).toContain("staffUsageShifts");
    expect(page).toContain("View details");
  });

  it("staff usage summary cards include five metrics", () => {
    const summaryCards = readSrc("components/reports/StaffUsageSummaryCards.tsx");
    expect(summaryCards).toContain("Staff Shown");
    expect(summaryCards).toContain("Completed Shifts");
    expect(summaryCards).toContain("Filled Shifts");
  });

  it("document compliance landing card is enabled", () => {
    const landing = readSrc("routes/_authenticated/reports.index.tsx");
    expect(landing).toContain('to: "/reports/documents"');
    expect(landing).toContain("available: true");
  });

  it("document compliance page includes advanced filters, summary cards, and mobile layout", () => {
    const page = readSrc("routes/_authenticated/reports.documents.tsx");
    const filters = readSrc("components/reports/DocumentComplianceFilters.tsx");
    const filterLib = readSrc("lib/report-document-filters.ts");
    const summaryCards = readSrc("components/reports/DocumentComplianceSummaryCards.tsx");
    expect(filters).toContain("ReportStaffMultiSelect");
    expect(filters).toContain("Overall Compliance");
    expect(filters).toContain("ReportMoreFiltersSection");
    expect(filters).toContain("VSC Renewal Due");
    expect(filters).toContain("First Aid Expiry");
    expect(filters).toContain("Upcoming Reminder");
    expect(filterLib).toContain("vscStatuses");
    expect(filterLib).toContain("overallCompliance");
    expect(filterLib).toContain("upcomingReminder");
    expect(page).toContain("parseDocumentComplianceFiltersFromSearch");
    expect(page).toContain("documentComplianceFiltersToApiQuery");
    expect(page).toContain("buildDocumentComplianceFilterChips");
    expect(filters).toContain("ReportActiveFilterChips");
    expect(page).toContain("The selected Staff member does not match the current filters");
    expect(page).toContain("ReportPagination");
    expect(summaryCards).toContain("Staff Shown");
    expect(summaryCards).toContain("Issue Flagged");
    expect(page).toContain("staffIds");
    expect(page).toContain("isSingleStaffSelection");
    expect(page).toContain("showComparison");
    expect(page).toContain("Renewal due");
    expect(page).toContain("No upcoming reminder");
    expect(page).toContain("lg:hidden");
    const labels = readSrc("lib/reports-document-labels.ts");
    expect(labels).toContain("Optional — Not Submitted");
    expect(page).not.toMatch(/Reminders enabled|Reminders disabled|3-year|Actual Hours|Payroll Hours/i);
    expect(filters).not.toContain("document-report-status");
  });

  it("activity log page includes coverage notice, compact rows, and dual pagination", () => {
    const page = readSrc("routes/_authenticated/reports.activity.tsx");
    const list = readSrc("components/reports/ActivityLogList.tsx");
    const pagination = readSrc("components/reports/ActivityLogPagination.tsx");
    const sharedPagination = readSrc("components/reports/ReportPagination.tsx");
    const labels = readSrc("lib/activity-log-labels.ts");
    const filters = readSrc("components/reports/ActivityLogFilters.tsx");

    expect(page).toContain("Activity history is based on events recorded by the platform");
    expect(page).toContain("defaultActivityLogSearch");
    expect(page).toContain("ACTIVITY_LOG_DEFAULT_PAGE_SIZE");
    expect(page).toContain("ActivityLogPagination");
    expect(page).toContain("ActivityLogList");
    expect(page).toContain("pageSize");
    expect(page).not.toMatch(/historically complete|complete audit trail/i);

    expect(list).toContain('href: "/staff/$id"');
    expect(list).toContain('href: "/centres/$id"');
    expect(list).toContain('href: "/shifts/$id"');
    expect(list).toContain("formatOpsCompactDateTimeToronto");
    expect(list).toContain("<table");
    expect(list).toContain("ActivityMobileRow");
    expect(list).toContain("ChevronDown");

    expect(pagination).toContain("ReportPagination");
    expect(sharedPagination).toContain("Previous");
    expect(sharedPagination).toContain("Next");
    expect(sharedPagination).toContain("REPORT_COMPARISON_PAGE_SIZE_OPTIONS");

    expect(labels).toContain("ACTIVITY_LOG_DEFAULT_PAGE_SIZE = 10");
    expect(labels).toContain("10, 25, 50");

    expect(filters).toContain("All categories");
    expect(filters).toContain("All actors");
  });
});

describe("reports date defaults", () => {
  it("returns a full Toronto calendar month", () => {
    const range = currentTorontoMonthRange();
    expect(range.dateFrom.endsWith("-01")).toBe(true);
    expect(range.dateFrom.slice(0, 7)).toBe(range.dateTo.slice(0, 7));
  });
});
