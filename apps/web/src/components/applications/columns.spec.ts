import { describe, expect, it } from "vitest";
import { columnsForRole } from "@/components/applications/columns";
import {
  childcareExperiencePreviewLabel,
  hasChildcareExperienceDescription,
} from "@/components/applications/ChildcareExperiencePreview";

describe("applications table columns", () => {
  it("includes childcare experience description column for every role", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      const keys = columnsForRole(role).map((c) => c.key);
      expect(keys).toContain("childcareExperience");
      expect(keys).toContain("experienceDuration");
    }
  });

  it("places childcare experience after experience duration", () => {
    const keys = columnsForRole("eca").map((c) => c.key);
    const durationIdx = keys.indexOf("experienceDuration");
    const experienceIdx = keys.indexOf("childcareExperience");
    expect(durationIdx).toBeGreaterThanOrEqual(0);
    expect(experienceIdx).toBe(durationIdx + 1);
  });

  it("does not add sortValue to childcare experience paragraph column", () => {
    const col = columnsForRole("eca").find((c) => c.key === "childcareExperience");
    expect(col?.header).toBe("Childcare Experience");
    expect(col?.sortValue).toBeUndefined();
  });
});

describe("childcare experience preview helpers", () => {
  it("shows Not provided for blank legacy values", () => {
    expect(hasChildcareExperienceDescription("")).toBe(false);
    expect(hasChildcareExperienceDescription("   ")).toBe(false);
    expect(hasChildcareExperienceDescription(undefined)).toBe(false);
    expect(childcareExperiencePreviewLabel("")).toBe("Not provided");
  });

  it("returns trimmed short text unchanged", () => {
    const text = "I worked for three years in a licensed childcare centre.";
    expect(childcareExperiencePreviewLabel(`  ${text}  `)).toBe(text);
  });

  it("preserves newline content for tooltip/full drawer display", () => {
    const text = "Line one\nLine two";
    expect(childcareExperiencePreviewLabel(text)).toBe(text);
    expect(text).toContain("\n");
  });

  it("handles long 2000-character responses without altering stored text", () => {
    const text = "a".repeat(2000);
    expect(childcareExperiencePreviewLabel(text)).toHaveLength(2000);
  });

  it("does not interpret HTML in experience text", () => {
    const text = "<script>alert(1)</script>";
    expect(childcareExperiencePreviewLabel(text)).toBe(text);
  });
});
