import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatAvailableStaffPriorityLine,
  isAvailableStaffPriorityBoundary,
} from "./shift-matching-priority-ui";
import type { AvailableStaff } from "./db";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function staff(overrides: Partial<AvailableStaff> = {}): AvailableStaff {
  return {
    id: "staff-1",
    legalName: "Alex Carer",
    displayName: "",
    useDisplayName: false,
    role: "ECE",
    isTop: true,
    contacted: false,
    matchingPriority: {
      group: 1,
      label: "RECE + Top + Same city",
      isTop: true,
      geographicTier: 0,
      geographicLabel: "Same city",
      qualificationType: "RECE",
    },
    ...overrides,
  };
}

describe("shift matching priority UI helpers", () => {
  it("formats the Ops priority line from API metadata only", () => {
    expect(formatAvailableStaffPriorityLine(staff())).toBe(
      "Priority 1 · RECE + Top + Same city",
    );
  });

  it("detects priority group boundaries", () => {
    const first = staff();
    const second = staff({
      id: "staff-2",
      matchingPriority: {
        ...first.matchingPriority,
        group: 2,
        label: "ECE + Top + Same city",
        qualificationType: "ECE",
      },
    });

    expect(isAvailableStaffPriorityBoundary(undefined, first)).toBe(false);
    expect(isAvailableStaffPriorityBoundary(first, second)).toBe(true);
    expect(isAvailableStaffPriorityBoundary(first, first)).toBe(false);
  });
});

describe("shift detail available staff priority presentation", () => {
  it("renders the priority line beneath each staff member", () => {
    const page = readFileSync(join(webRoot, "routes/_authenticated/shifts.$id.tsx"), "utf8");
    const list = readFileSync(join(webRoot, "components/shifts/ShiftAvailableStaffList.tsx"), "utf8");
    expect(page).toContain("ShiftAvailableStaffList");
    expect(list).toContain("formatAvailableStaffPriorityLine");
    expect(list).toContain("isAvailableStaffPriorityBoundary");
  });
});
