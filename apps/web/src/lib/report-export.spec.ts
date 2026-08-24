import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { downloadReportCsv, reportExportPaths } from "./report-export";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("report-export", () => {
  it("defines export paths for all five reports", () => {
    expect(reportExportPaths.shiftFulfillment).toBe("/reports/shift-fulfillment/export");
    expect(reportExportPaths.centreUsage).toBe("/reports/centre-usage/export");
    expect(reportExportPaths.staffUsage).toBe("/reports/staff-usage/export");
    expect(reportExportPaths.documentCompliance).toBe("/reports/documents/export");
    expect(reportExportPaths.activityLog).toBe("/reports/activity/export");
  });

  it("omits page and pageSize from export query string", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", rel: "", click, remove: vi.fn() };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'attachment; filename="shift-fulfillment.csv"',
      },
      blob: () => Promise.resolve(new Blob(["test"])),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:test",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    await downloadReportCsv("/reports/shift-fulfillment/export", {
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      page: 3,
      pageSize: 10,
      centreIds: ["aaa", "bbb"],
    });

    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("dateFrom=2026-08-01");
    expect(calledUrl).toContain("centreIds=aaa%2Cbbb");
    expect(calledUrl).not.toContain("page=");
    expect(calledUrl).not.toContain("pageSize=");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: "include" });
    expect(click).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("surfaces API error message on failed export", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Export limit exceeded" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadReportCsv("/reports/activity/export", { dateFrom: "2026-08-01" }),
    ).rejects.toThrow("Export limit exceeded");

    vi.unstubAllGlobals();
  });
});

describe("report export UI wiring", () => {
  const reportPages = [
    "routes/_authenticated/reports.centre-usage.tsx",
    "routes/_authenticated/reports.staff-usage.tsx",
    "routes/_authenticated/reports.documents.tsx",
    "routes/_authenticated/reports.activity.tsx",
  ] as const;

  it.each(reportPages)("includes Export CSV button on %s", (pagePath) => {
    const source = readSrc(pagePath);
    expect(source).toContain("ReportExportButton");
    expect(source).toContain("reportExportPaths");
  });

  it("redirects legacy shift fulfillment route instead of rendering export UI", () => {
    const source = readSrc("routes/_authenticated/reports.shift-fulfillment.tsx");
    expect(source).toContain('to: "/reports/centre-usage"');
    expect(source).not.toContain("ReportExportButton");
  });

  it("disables export when totalCount is zero", () => {
    const button = readSrc("components/reports/ReportExportButton.tsx");
    expect(button).toContain("totalCount === 0");
    expect(button).toContain("Exporting…");
    expect(button).toContain("Could not export this report");
  });

  it("document compliance filters remain unchanged aside from export", () => {
    const filters = readSrc("components/reports/DocumentComplianceFilters.tsx");
    expect(filters).not.toContain("ReportExportButton");
    expect(filters).toContain("ReportMoreFiltersSection");
  });
});
