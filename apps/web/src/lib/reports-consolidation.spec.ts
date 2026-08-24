import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapShiftFulfillmentSearchToCentreUsage } from "./reports-shift-fulfillment-redirect";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("reports consolidation", () => {
  it("landing page shows Centre & Shift Performance and not Shift Fulfillment", () => {
    const landing = readSrc("routes/_authenticated/reports.index.tsx");
    expect(landing).toContain("Centre & Shift Performance");
    expect(landing).toContain(
      "Review fill performance, shift volume, and scheduled staffing hours by centre.",
    );
    expect(landing).toContain('to: "/reports/centre-usage"');
    expect(landing).not.toContain("Shift Fulfillment");
    expect(landing).not.toContain("Centre Usage");
  });

  it("keeps canonical route at /reports/centre-usage", () => {
    const page = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(page).toContain('"/_authenticated/reports/centre-usage"');
    expect(page).toContain("Centre & Shift Performance");
  });

  it("redirects legacy shift fulfillment route to centre usage", () => {
    const page = readSrc("routes/_authenticated/reports.shift-fulfillment.tsx");
    expect(page).toContain('to: "/reports/centre-usage"');
    expect(page).toContain("replace: true");
    expect(page).toContain("mapShiftFulfillmentSearchToCentreUsage");
    expect(page).not.toContain("ShiftFulfillmentReport");
  });

  it("preserves compatible shift fulfillment search state on redirect", () => {
    const mapped = mapShiftFulfillmentSearchToCentreUsage({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      centreIds: "abc,def",
      centreId: "abc",
      page: 2,
      pageSize: 50,
      fillRateMin: "50",
      pendingMax: "10",
    });

    expect(mapped).toEqual({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      centreIds: "abc,def",
      centreId: "abc",
      page: 2,
      pageSize: 50,
      fillRateMin: "50",
      pendingMax: "10",
    });
  });

  it("wires city filter through centre usage page and API client", () => {
    const page = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    const api = readSrc("lib/reports-api.ts");
    const filters = readSrc("components/reports/CentreUsageFilters.tsx");

    expect(page).toContain("cities: z.string().optional()");
    expect(page).toContain("resolveAppliedCitySelection");
    expect(page).toContain("citySelectionToApiQuery");
    expect(page).toContain("CentreUsageFilters");
    expect(api).toContain("cities?: string[]");
    expect(filters).toContain("ReportCityMultiSelect");
    expect(filters).toContain("SUPPORTED_CITIES");
  });
});
