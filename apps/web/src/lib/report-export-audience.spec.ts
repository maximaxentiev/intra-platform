import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("report export audience", () => {
  it("shift detail export uses audience dialog with Ops and Centre options", () => {
    const detail = readSrc("components/reports/CentreUsageShiftDetail.tsx");
    expect(detail).toContain("ReportExportAudienceButton");
    expect(detail).not.toContain("ReportExportButton");

    const button = readSrc("components/reports/ReportExportAudienceButton.tsx");
    expect(button).toContain("Export report");
    expect(button).toContain("Who is this report for?");
    expect(button).toContain("Ops team");
    expect(button).toContain("Uses Carer display names.");
    expect(button).toContain("Centre");
    expect(button).toContain("Uses Carer legal names.");
    expect(button).toContain('audience: selectedAudience');
  });

  it("disables Centre export when multiple centres are selected", () => {
    const button = readSrc("components/reports/ReportExportAudienceButton.tsx");
    expect(button).toContain("centreIds.length !== 1");
    expect(button).toContain("Select a Centre before exporting a Centre version.");
    expect(button).toContain('disabled={centreExportBlocked}');
  });

  it("ops-only reports keep direct export without audience dialog", () => {
    const opsOnlyPages = [
      "routes/_authenticated/reports.staff-usage.tsx",
      "routes/_authenticated/reports.documents.tsx",
      "routes/_authenticated/reports.activity.tsx",
    ] as const;

    for (const pagePath of opsOnlyPages) {
      const source = readSrc(pagePath);
      expect(source).toContain("ReportExportButton");
      expect(source).not.toContain("ReportExportAudienceButton");
    }
  });

  it("centre usage summary export stays direct without audience dialog", () => {
    const page = readSrc("routes/_authenticated/reports.centre-usage.tsx");
    expect(page).toContain("ReportExportButton");
    expect(page).not.toContain("ReportExportAudienceButton");
  });
});
