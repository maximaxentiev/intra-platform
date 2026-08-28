import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { columnsForRole } from "@/components/applications/columns";
import {
  childcareExperiencePreviewLabel,
  hasChildcareExperienceDescription,
} from "@/components/applications/ChildcareExperiencePreview";
import { availableActions } from "@/lib/application-actions";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const applicationsPage = read("routes/_authenticated/applications.tsx");
const applicationActions = read("components/applications/ApplicationActions.tsx");
const applicationDrawer = read("components/applications/ApplicationDrawer.tsx");
const filtersPanel = read("components/applications/ApplicationsFilters.tsx");

const REMOVED_COMPLIANCE_COLUMNS = ["vsc", "vscDate", "firstAid", "cprExpiry", "immunizations"] as const;

function columnKeys(role: "eca" | "ece_rece" | "nanny") {
  return columnsForRole(role).map((c) => c.key);
}

describe("applications table columns", () => {
  it("includes childcare experience description column for every role", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      const keys = columnKeys(role);
      expect(keys).toContain("childcareExperience");
      expect(keys).toContain("experienceDuration");
    }
  });

  it("places childcare experience after experience duration", () => {
    const keys = columnKeys("eca");
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

  it("does not include Status in dynamic column definitions", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      expect(columnKeys(role)).not.toContain("status");
    }
  });

  it("removes redundant required compliance document columns from every role", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      const keys = columnKeys(role);
      for (const key of REMOVED_COMPLIANCE_COLUMNS) {
        expect(keys).not.toContain(key);
      }
    }
  });

  it("retains COVID-19 and Documents columns for differentiating optional uploads", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      const keys = columnKeys(role);
      expect(keys).toContain("covid");
      expect(keys).toContain("documents");
    }
  });

  it("does not show GTA Eligible or Qualification as list columns", () => {
    for (const role of ["eca", "ece_rece", "nanny"] as const) {
      const keys = columnKeys(role);
      expect(keys).not.toContain("gtaEligible");
      expect(keys).not.toContain("qualification");
    }
  });

  it("keeps nanny-specific training columns and other shared list columns", () => {
    expect(columnKeys("eca")).toEqual(
      expect.arrayContaining(["email", "childcareExperience", "covid", "documents"]),
    );
    expect(columnKeys("ece_rece")).toEqual(
      expect.arrayContaining(["email", "childcareExperience", "covid", "documents"]),
    );
    expect(columnKeys("nanny")).toEqual(
      expect.arrayContaining([
        "experienceTypes",
        "trainingCompleted",
        "trainingDescription",
        "childcareExperience",
        "covid",
        "documents",
      ]),
    );
  });
});

describe("applications list presentation (R9/R11)", () => {
  it("does not render a Status table column in the list page", () => {
    expect(applicationsPage).not.toContain("ApplicationStatusBadge");
    expect(applicationsPage).not.toMatch(/toggleSort\("status"\)/);
    expect(applicationsPage).not.toMatch(/>\s*Status\s*\{/);
  });

  it("removes Reject from action buttons while keeping Interview and Hire stubs", () => {
    expect(applicationActions).not.toContain('"reject"');
    expect(applicationActions).not.toMatch(/>\s*Reject\s*</);
    expect(applicationActions).not.toContain('setDialog("reject")');
    expect(applicationActions).toContain("Interview");
    expect(applicationActions).toContain("Hire");
  });

  it("offers Interview and Hire only for actionable application statuses", () => {
    expect(availableActions("new")).toEqual({ interview: "available", hire: "available" });
    expect(availableActions("contacted")).toEqual({ interview: "done", hire: "available" });
    expect(availableActions("hired")).toEqual({ interview: "hidden", hire: "hidden" });
  });
});

describe("applications filter panel layout (R12)", () => {
  it("uses viewport-constrained flex layout with scrollable body", () => {
    expect(filtersPanel).toContain("max-h-[min(calc(100dvh-2rem),32rem)]");
    expect(filtersPanel).toContain("overflow-hidden");
    expect(filtersPanel).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(filtersPanel).not.toContain("ScrollArea");
  });

  it("keeps header actions and bottom date filters reachable in the scroll body", () => {
    expect(filtersPanel).toContain("Clear all");
    expect(filtersPanel).toContain("Close");
    expect(filtersPanel).toContain('label="CPR Expiry"');
    expect(filtersPanel).toContain('label="Status"');
  });
});

describe("application drawer regression", () => {
  it("still exposes full compliance documents in the drawer", () => {
    expect(applicationDrawer).toContain('title="Compliance"');
    expect(applicationDrawer).toContain('label="Vulnerable sector check"');
    expect(applicationDrawer).toContain('label="First aid & CPR"');
    expect(applicationDrawer).toContain('label="Immunizations"');
    expect(applicationDrawer).toContain("ApplicationStatusBadge");
  });

  it("still exposes qualification and GTA eligibility in the applicant detail drawer", () => {
    expect(applicationDrawer).toContain('label="GTA eligible"');
    expect(applicationDrawer).toContain('label="Qualification status"');
    expect(applicationDrawer).toContain("row.roleSpecific.qualificationStatus");
    expect(applicationDrawer).toContain("row.eligibility.gtaEligible");
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
