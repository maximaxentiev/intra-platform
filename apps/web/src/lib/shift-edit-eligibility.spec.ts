import { describe, expect, it } from "vitest";
import {
  canEditShiftFields,
  isShiftHistorical,
  shouldLoadAvailableStaff,
  showAssignedCarerSection,
} from "./shift-edit-eligibility";

describe("shift edit eligibility", () => {
  it("allows pending and filled edits", () => {
    expect(canEditShiftFields("pending")).toBe(true);
    expect(canEditShiftFields("filled")).toBe(true);
    expect(canEditShiftFields("cancelled")).toBe(false);
    expect(canEditShiftFields("completed")).toBe(false);
  });

  it("loads matching only for pending unassigned shifts", () => {
    expect(shouldLoadAvailableStaff("pending", null)).toBe(true);
    expect(shouldLoadAvailableStaff("pending", "staff-1")).toBe(false);
    expect(shouldLoadAvailableStaff("filled", null)).toBe(false);
  });

  it("shows assigned carer for filled and completed", () => {
    expect(showAssignedCarerSection("filled", "staff-1")).toBe(true);
    expect(showAssignedCarerSection("completed", "staff-1")).toBe(true);
    expect(showAssignedCarerSection("pending", null)).toBe(false);
  });

  it("treats cancelled and completed as historical", () => {
    expect(isShiftHistorical("cancelled")).toBe(true);
    expect(isShiftHistorical("completed")).toBe(true);
    expect(isShiftHistorical("pending")).toBe(false);
  });
});
