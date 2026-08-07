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
    expect(src).toContain("max-w-full");
  });

  it("renders preview values as React text without dangerous HTML", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).not.toContain("dangerouslySetInnerHTML");
    expect(src).toContain("{row.displayName");
    expect(src).toContain("{row.role");
    expect(src).toContain("{row.email");
    expect(src).toContain("{row.phone");
  });

  it("shows phone in preview table header and renders normalized values literally", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain(">Phone</th>");
    expect(src).toMatch(/\{row\.phone \|\| "—"\}/);
    expect(src).not.toMatch(/row\.phone\.(replace|trim|slice)/);
  });

  it("shows phone in import results row table", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain("results.rows.map");
    expect(src).toContain("{row.phone ||");
    expect(src).toContain("md:hidden");
  });

  it("keeps preview row status filters unchanged", () => {
    const src = readSrc("routes/_authenticated/staff.import.tsx");
    expect(src).toContain('filter === "valid"');
    expect(src).toContain('filter === "invalid"');
    expect(src).toContain('row.status === "duplicate"');
  });
});
