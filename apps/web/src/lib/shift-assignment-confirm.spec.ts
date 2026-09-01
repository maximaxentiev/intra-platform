import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildShiftAssignmentConfirmDetails,
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from "./shift-assignment-confirm";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("shift assignment confirm details", () => {
  it("formats Toronto-style date and time labels", () => {
    expect(formatShiftAssignmentDateLabel("2026-08-29")).toBe("August 29, 2026");
    expect(formatShiftAssignmentTimeRange("09:00:00", "17:00:00")).toBe("9:00 AM–5:00 PM");
  });

  it("builds confirmation details using Staff legal name", () => {
    expect(
      buildShiftAssignmentConfirmDetails({
        staffLegalName: "Jaspreet Kaur",
        centreName: "ABC Child Care",
        shiftDate: "2026-08-29",
        startTime: "09:00:00",
        endTime: "17:00:00",
        roleNeeded: "ECE",
      }),
    ).toEqual({
      staffLegalName: "Jaspreet Kaur",
      centreName: "ABC Child Care",
      dateLabel: "August 29, 2026",
      timeLabel: "9:00 AM–5:00 PM",
      roleLabel: "ECE",
    });
  });
});

describe("ops shift assignment confirmation UI", () => {
  it("opens confirmation dialog before calling assign API", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(page).toContain("ShiftAssignmentConfirmDialog");
    expect(page).toContain("openAssignConfirm");
    expect(page).toContain("confirmAssignStaff");
    expect(page).toContain("buildShiftAssignmentConfirmDetails");
    expect(page).not.toMatch(/onClick=\{\(\) => assignStaff\(/);
  });

  it("uses structured assign response and resend endpoint", () => {
    const db = readSrc("lib/db.ts");
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    const staffList = readSrc("components/shifts/ShiftAvailableStaffList.tsx");
    expect(db).toContain("ShiftAssignResponse");
    expect(page).toContain("shiftAssignmentFeedbackMessage");
    expect(staffList).toContain("Manage assignment");
    expect(page).toContain("assigningStaffId");
  });

  it("shows legal name and shift context in confirmation dialog", () => {
    const dialog = readSrc("components/shifts/ShiftAssignmentConfirmDialog.tsx");
    expect(dialog).toContain("Confirm Staff assignment");
    expect(dialog).toContain("Confirm assignment");
    expect(dialog).toContain("Staff");
    expect(dialog).toContain("Centre");
    expect(dialog).toContain("Date");
    expect(dialog).toContain("Time");
    expect(dialog).toContain("Role required");
    expect(dialog).toContain("batchCentreDeferred");
    expect(dialog).toContain("Centre confirmation will be sent through the Batch Request");
  });

  it("keeps dialog open on failure and closes only after successful assign", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(page).toContain("if (success) closeAssignConfirm()");
    expect(page).toContain("return false");
    expect(page).toContain("return true");
  });

  it("disables confirm while assignment request is pending", () => {
    const dialog = readSrc("components/shifts/ShiftAssignmentConfirmDialog.tsx");
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(dialog).toContain("confirming");
    expect(dialog).toContain("Confirming assignment…");
    expect(page).toContain("confirming={assigningStaffId != null}");
  });

  it("allows Escape and outside click to cancel only when not confirming", () => {
    const dialog = readSrc("components/shifts/ShiftAssignmentConfirmDialog.tsx");
    expect(dialog).toContain("if (!confirming) onOpenChange(next)");
  });

  it("does not call assign API from Assign button directly", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(page).toContain("onAssign={openAssignConfirm}");
    expect(page).not.toMatch(/onClick=\{\(\) => assignStaff\(/);
    expect(page).not.toMatch(/onClick=\{\(\) => void assignStaff\(/);
  });

  it("does not call assign when dialog is cancelled", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(page).toContain("closeAssignConfirm");
    expect(page).toContain("setPendingAssignStaff(null)");
  });

  it("calls assign exactly once from confirm handler using legal name", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    expect(page).toContain("await assignStaff(pendingAssignStaff.id, pendingAssignStaff.legalName, {");
    expect(page).toContain("notifyPreviousCarer");
    expect(page).toContain("onConfirm={() => void confirmAssignStaff()}");
  });

  it("keeps matching priority display unchanged in staff list", () => {
    const page = readSrc("routes/_authenticated/shifts.$id.tsx");
    const list = readSrc("components/shifts/ShiftAvailableStaffList.tsx");
    expect(page).toContain("ShiftAvailableStaffList");
    expect(list).toContain("formatAvailableStaffPriorityChips");
    expect(list).toContain("isAvailableStaffPriorityBoundary");
  });
});
