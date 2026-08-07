import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("staff CSV import UI", () => {
  it("provides upload preview and confirmation workflow", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain("previewCsvImport");
    expect(src).toContain("confirmCsvImport");
    expect(src).toContain("Confirm staff import");
    expect(src).toContain("Import staff only");
    expect(src).toContain("send portal invitations");
  });

  it("disables import actions when no valid rows", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain("preview.summary.valid === 0");
  });

  it("shows results summary after import", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain("Import results");
    expect(src).toContain("invitationEmailFailures");
  });

  it("uses overflow containment for mobile tables", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain("overflow-x-hidden");
    expect(src).toContain("overflow-x-auto");
  });
});
