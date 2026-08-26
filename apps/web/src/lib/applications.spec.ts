import { describe, expect, it } from "vitest";
import {
  DOCUMENT_LABELS,
  DOCUMENT_SHORT_LABELS,
  label,
  type DocumentCategory,
} from "./applications";

describe("applications document labels", () => {
  it("labels structured qualification categories for Ops display", () => {
    expect(DOCUMENT_LABELS.eca_diploma).toBe("ECA Diploma");
    expect(DOCUMENT_LABELS.ece_diploma).toBe("ECE Diploma");
    expect(DOCUMENT_LABELS.rece_proof).toBe("RECE Proof");
    expect(DOCUMENT_LABELS.qualification_certificate).toBe("Qualification Certificate");
  });

  it("provides short labels for document chips", () => {
    const structured: DocumentCategory[] = ["eca_diploma", "ece_diploma", "rece_proof"];
    for (const category of structured) {
      expect(DOCUMENT_SHORT_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("keeps legacy qualification status labels", () => {
    expect(label("eca_canada")).toContain("ECA");
    expect(label("ece_canada")).toContain("ECE");
    expect(label("rece_registered")).toContain("RECE");
  });
});

describe("applications childcare experience display", () => {
  it("preserves raw applicant text for safe literal rendering", () => {
    const raw = "<script>alert(1)</script>\nLine two";
    expect(raw).toContain("<script>");
    expect(label("none")).toBe("No experience");
  });
});
