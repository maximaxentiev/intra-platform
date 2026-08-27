import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NEW_SHIFT_ROLE_OPTIONS,
  formatShiftRoleLabel,
  shiftRoleEditOptions,
} from "./shift-role-ui";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("shift role UI helpers", () => {
  it("offers ECA, ECE, and RECE for new shift creation", () => {
    expect(NEW_SHIFT_ROLE_OPTIONS.map((option) => option.value)).toEqual(["ECA", "ECE", "RECE"]);
  });

  it("does not offer Nanny for new shift creation", () => {
    expect(NEW_SHIFT_ROLE_OPTIONS.some((option) => option.value === "Nanny")).toBe(false);
  });

  it("preserves legacy Nanny in edit options without offering it for new values", () => {
    const options = shiftRoleEditOptions("Nanny");
    expect(options[0]).toEqual({ value: "Nanny", label: "Nanny (legacy)" });
    expect(options.map((option) => option.value)).toEqual(["Nanny", "ECA", "ECE", "RECE"]);
  });

  it("formats RECE and legacy Nanny labels for display", () => {
    expect(formatShiftRoleLabel("RECE")).toBe("RECE");
    expect(formatShiftRoleLabel("Nanny")).toBe("Nanny");
  });
});

describe("centre qualification controls removed from UI", () => {
  it("does not expose centre-level qualification matching settings", () => {
    const form = readFileSync(join(webRoot, "components/CentreForm.tsx"), "utf8");
    const details = readFileSync(join(webRoot, "components/centres/CentreDetailsCard.tsx"), "utf8");

    expect(form).not.toContain("requiresQualificationForMatching");
    expect(form).not.toContain("eceQualificationRequirement");
    expect(form).not.toContain("Require qualification for Staff matching");
    expect(details).not.toContain("Qualification requirement");
  });
});

describe("shift create selector", () => {
  it("uses shared active shift roles and excludes Nanny", () => {
    const create = readFileSync(join(webRoot, "routes/_authenticated/shifts.new.tsx"), "utf8");
    expect(create).toContain("NEW_SHIFT_ROLE_OPTIONS");
    expect(create).not.toContain('value="Nanny"');
    expect(create).toContain("Role required");
  });
});
