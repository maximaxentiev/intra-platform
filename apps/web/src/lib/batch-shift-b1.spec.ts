import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  batchDraftRowHasContent,
  computeBatchProgress,
  deriveBatchDisplayState,
  duplicateBatchDraftShift,
  validateBatchDraftRow,
  validateBatchDraftRows,
  createEmptyBatchDraftShift,
} from "./batch-shift-ui";
import type { ShiftBatchChildSummary } from "./db";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("batch progress", () => {
  const shifts: ShiftBatchChildSummary[] = [
    {
      id: "1",
      shiftDate: "2026-09-01",
      startTime: "08:00:00",
      endTime: "16:00:00",
      roleNeeded: "ECE",
      addedToStaffpoint: false,
      status: "filled",
      confirmationNotes: null,
      assignedStaffId: "s1",
      assignedLegalName: "A",
      assignedDisplayName: null,
      assignedUseDisplayName: false,
    },
    {
      id: "2",
      shiftDate: "2026-09-02",
      startTime: "08:00:00",
      endTime: "16:00:00",
      roleNeeded: "ECE",
      addedToStaffpoint: false,
      status: "completed",
      confirmationNotes: null,
      assignedStaffId: "s2",
      assignedLegalName: "B",
      assignedDisplayName: null,
      assignedUseDisplayName: false,
    },
    {
      id: "3",
      shiftDate: "2026-09-03",
      startTime: "08:00:00",
      endTime: "16:00:00",
      roleNeeded: "ECE",
      addedToStaffpoint: false,
      status: "pending",
      confirmationNotes: null,
      assignedStaffId: null,
      assignedLegalName: null,
      assignedDisplayName: null,
      assignedUseDisplayName: null,
    },
    {
      id: "4",
      shiftDate: "2026-09-04",
      startTime: "08:00:00",
      endTime: "16:00:00",
      roleNeeded: "ECE",
      addedToStaffpoint: false,
      status: "cancelled",
      confirmationNotes: null,
      assignedStaffId: null,
      assignedLegalName: null,
      assignedDisplayName: null,
      assignedUseDisplayName: null,
    },
  ];

  it("counts filled and completed as fulfilled and excludes cancelled from denominator", () => {
    const progress = computeBatchProgress(shifts);
    expect(progress.activeTotal).toBe(3);
    expect(progress.fulfilledCount).toBe(2);
    expect(progress.cancelledCount).toBe(1);
    expect(progress.percentage).toBe(67);
  });

  it("derives ready when all active children are fulfilled", () => {
    const fulfilledOnly = shifts.map((shift) =>
      shift.status === "pending" ? { ...shift, status: "filled" as const } : shift,
    );
    const progress = computeBatchProgress(fulfilledOnly);
    expect(deriveBatchDisplayState(null, progress)).toBe("ready");
  });
});

describe("batch draft validation", () => {
  it("requires core fields per row", () => {
    const errors = validateBatchDraftRow(createEmptyBatchDraftShift());
    expect(errors.shiftDate).toBeTruthy();
    expect(errors.startTime).toBeTruthy();
    expect(errors.endTime).toBeTruthy();
    expect(errors.roleNeeded).toBeTruthy();
  });

  it("requires centre for the batch form", () => {
    const result = validateBatchDraftRows("", [createEmptyBatchDraftShift()]);
    expect(result.formError).toMatch(/centre/i);
  });
});

describe("duplicate draft behavior", () => {
  it("copies schedule, role, staffpoint, and shift notes but not internal comment", () => {
    const source = {
      ...createEmptyBatchDraftShift("source"),
      shiftDate: "2026-09-10",
      startTime: "09:00",
      endTime: "17:00",
      roleNeeded: "RECE",
      addedToStaffpoint: true,
      confirmationNotes: "Side door",
      internalComment: "Ops only",
    };
    const duplicate = duplicateBatchDraftShift(source);
    expect(duplicate.shiftDate).toBe(source.shiftDate);
    expect(duplicate.startTime).toBe(source.startTime);
    expect(duplicate.endTime).toBe(source.endTime);
    expect(duplicate.roleNeeded).toBe(source.roleNeeded);
    expect(duplicate.addedToStaffpoint).toBe(true);
    expect(duplicate.confirmationNotes).toBe("Side door");
    expect(duplicate.internalComment).toBe("");
    expect(duplicate.key).not.toBe(source.key);
  });
});

describe("batch draft content detection", () => {
  it("detects when centre change should warn", () => {
    const row = createEmptyBatchDraftShift();
    expect(batchDraftRowHasContent(row)).toBe(false);
    row.shiftDate = "2026-09-01";
    expect(batchDraftRowHasContent(row)).toBe(true);
  });
});

describe("Batch Shift Requests Phase B1 UI", () => {
  const list = read("routes/_authenticated/shifts.index.tsx");
  const create = read("routes/_authenticated/shifts.new.tsx");
  const detail = read("routes/_authenticated/shifts.$id.tsx");
  const batchCreate = read("routes/_authenticated/shifts.batches.new.tsx");
  const batchWorkspace = read("routes/_authenticated/shifts.batches.$id.tsx");
  const childCard = read("components/shifts/BatchWorkspaceChildCard.tsx");
  const createActions = read("components/shifts/CreateShiftActions.tsx");

  it("offers individual and batch create choices without making batch the default", () => {
    expect(createActions).toContain('to="/shifts/new"');
    expect(createActions).toContain('to="/shifts/batches/new"');
    expect(createActions).toContain("Create Individual Shift");
    expect(createActions).toContain("Create Batch Request");
    expect(list).toContain("CreateShiftActions");
  });

  it("persists Shift Notes via confirmationNotes on individual create and detail", () => {
    expect(create).toContain("ShiftNotesField");
    expect(create).toContain("confirmationNotes");
    expect(create).not.toContain("notes:");
    expect(detail).toContain("Shift Notes");
    expect(detail).toContain("confirmationNotes");
    expect(detail).not.toContain("shift.notes");
    expect(detail).toContain("Part of Batch Request");
    expect(detail).toContain("Back to Batch");
  });

  it("uses atomic batch create endpoint and maps notes separately", () => {
    expect(batchCreate).toContain("shiftBatchesApi.createWithShifts");
    expect(batchCreate).toContain("confirmationNotes");
    expect(batchCreate).toContain("internalComment");
    expect(batchCreate).toContain("Create Batch Request");
    expect(batchCreate).toContain("Duplicate");
    expect(batchCreate).toContain("Add shift");
    expect(batchCreate).not.toContain("Complete Request");
  });

  it("loads workspace from one batch request and lazy-loads operational data on expand", () => {
    expect(batchWorkspace).toContain('queryKey: ["shift-batch", id]');
    expect(batchWorkspace).not.toContain("availableStaff");
    expect(batchWorkspace).not.toContain("ShiftActivityLogPanel");
    expect(childCard).toContain("BatchWorkspaceExpandedChild");
    expect(childCard).not.toContain("ShiftComments");
    expect(read("components/shifts/BatchWorkspaceExpandedChild.tsx")).toContain("ShiftResendConfirmationDialog");
  });

  it("does not add premature batch communication behavior", () => {
    expect(batchWorkspace).not.toContain("Complete Request");
    expect(batchWorkspace).not.toContain("70%");
    expect(batchCreate).not.toContain("send-assignment-confirmation");
  });
});

describe("30-row batch create usability", () => {
  it("keeps compact draft rows with expandable notes areas", () => {
    const batchCreate = read("routes/_authenticated/shifts.batches.new.tsx");
    const row = read("components/shifts/BatchDraftShiftRow.tsx");
    expect(batchCreate).toContain("BatchDraftShiftRow");
    expect(row).toContain("detailsOpen");
    expect(row).toContain("ShiftNotesField");
    expect(row).toContain("Internal Comment");
    expect(row).not.toContain("legend=\"Internal\"");
  });
});
