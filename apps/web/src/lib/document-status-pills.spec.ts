import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expiryDisplayLabel, reviewStatusLabel } from "@/lib/carer-documents";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("DocumentStatusPills presentation", () => {
  it("formats backend review statuses without deriving compliance", () => {
    const src = readSrc("components/documents/DocumentStatusPills.tsx");
    expect(src).toContain("reviewStatusLabel");
    expect(src).toContain("expiryDisplayLabel");
    expect(src).not.toMatch(/deriveStaff|complianceForRequired|new Date\(/);
  });

  it("maps unknown review statuses through shared label helper", () => {
    expect(reviewStatusLabel("unexpected_status")).toBe("unexpected status");
  });

  it("hides expiry pill label when backend sends no_expiry", () => {
    expect(expiryDisplayLabel("no_expiry")).toBeNull();
  });

  it("shows backend expiry display labels", () => {
    expect(expiryDisplayLabel("expiring_soon")).toBe("Expiring Soon");
  });
});

describe("Lovable carer documents presentation guardrails", () => {
  it("uses editable VSC processed and expiry date fields", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).toContain('dateField === "both"');
    expect(src).toContain("onExpiryDateChange");
    expect(src).not.toContain("Calculated by Intra");
  });

  it("preserves local draft save architecture", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).toContain("useUnsavedChangesGuard");
    expect(src).toContain("buildCategorySaveFormData");
    expect(src).toContain("retainFileIds");
    expect(src).not.toMatch(/auto.?upload/i);
  });

  it("uses click-to-select upload copy without drag-and-drop handlers", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).toContain("Add files");
    expect(src).not.toMatch(/onDrop|onDragOver|onDragEnter/i);
  });
});

describe("scoped mobile toast offset", () => {
  it("only lifts toasts on carer documents routes", () => {
    const src = readSrc("routes/__root.tsx");
    expect(src).toContain("carerDocumentsStickyBarRoute");
    expect(src).toContain("/carer/onboarding/documents");
    expect(src).toContain("/carer/documents");
    expect(src).toContain("mobileOffset={toastMobileOffset}");
  });
});
