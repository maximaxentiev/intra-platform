import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

function readSrc(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("centre shift history UI", () => {
  it("exposes Email shift history on Centre Shifts tab", () => {
    const tab = readSrc("components/centres/CentreShiftsTab.tsx");
    expect(tab).toContain("Email shift history");
    expect(tab).toContain("CentreShiftHistoryDialog");
  });

  it("dialog includes date range, recipient, download, and send actions", () => {
    const dialog = readSrc("components/centres/CentreShiftHistoryDialog.tsx");
    expect(dialog).toContain("Email shift history");
    expect(dialog).toContain("ReportDateRangeFields");
    expect(dialog).toContain("Sending to:");
    expect(dialog).toContain("Download CSV");
    expect(dialog).toContain("Send email");
    expect(dialog).not.toMatch(/recipientEmail|custom recipient/i);
  });

  it("disables actions for empty history and missing primary contact", () => {
    const dialog = readSrc("components/centres/CentreShiftHistoryDialog.tsx");
    expect(dialog).toContain("canDownloadCsv");
    expect(dialog).toContain("canSendEmail");
    expect(dialog).toContain("missingPrimaryContactMessage");
    expect(dialog).toContain("emptyMessage");
  });

  it("uses centre-scoped API paths", () => {
    const lib = readSrc("lib/centre-shift-history.ts");
    expect(lib).toContain("/shift-history/preview");
    expect(lib).toContain("/shift-history/export");
    expect(lib).toContain("/shift-history/email");
  });
});

describe("report export audience regression", () => {
  it("keeps audience dialog on centre usage shift detail only", () => {
    const detail = readSrc("components/reports/CentreUsageShiftDetail.tsx");
    expect(detail).toContain("ReportExportAudienceButton");
    const tab = readSrc("components/centres/CentreShiftsTab.tsx");
    expect(tab).not.toContain("ReportExportAudienceButton");
  });
});
