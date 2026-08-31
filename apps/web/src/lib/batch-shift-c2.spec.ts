import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canEditShiftFields,
  isShiftHistorical,
  shouldLoadAvailableStaff,
  showAssignedCarerSection,
} from "./shift-edit-eligibility";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

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

describe("Batch Shift Requests Phase C2", () => {
  const batchWorkspace = read("routes/_authenticated/shifts.batches.$id.tsx");
  const childCard = read("components/shifts/BatchWorkspaceChildCard.tsx");
  const expanded = read("components/shifts/BatchWorkspaceExpandedChild.tsx");
  const assignDialog = read("components/shifts/ShiftAssignmentConfirmDialog.tsx");

  it("lazy-loads matching and comments only in expanded child", () => {
    expect(batchWorkspace).not.toContain("availableStaff");
    expect(childCard).not.toContain("ShiftComments");
    expect(childCard).toContain("BatchWorkspaceExpandedChild");
    expect(expanded).toContain('queryKey: ["shift-available", shiftId]');
    expect(expanded).toContain("enabled: loadMatching");
    expect(expanded).toContain("<ShiftComments shiftId={shiftId} enabled />");
  });

  it("reuses operational dialogs and C1 batch deferral", () => {
    expect(expanded).toContain("ShiftAssignmentConfirmDialog");
    expect(expanded).toContain("batchCentreDeferred={batchCentreDeferred}");
    expect(expanded).toContain("ShiftResendConfirmationDialog");
    expect(expanded).toContain("ShiftUnassignDialog");
    expect(expanded).toContain("ShiftCancelDialog");
    expect(expanded).toContain("ShiftEditCommunicationsDialog");
    expect(expanded).toContain("applyBatchCentreDeferral");
    expect(expanded).toContain("invalidateShiftOperationalQueries");
  });

  it("shows batch defer copy before assignment confirmation", () => {
    expect(assignDialog).toContain("batchCentreDeferred");
    expect(assignDialog).toContain("Centre confirmation will be sent through the Batch Request");
  });

  it("does not add batch-level comments", () => {
    expect(batchWorkspace).not.toContain("Batch comments");
  });

  it("keeps one expanded child model with visual highlight", () => {
    expect(batchWorkspace).toContain("expandedShiftId");
    expect(childCard).toContain("data-expanded");
    expect(childCard).toContain("ring-primary");
  });

  it("invalidates batch workspace and shifts feed after operations", () => {
    expect(expanded).toContain("invalidateShiftOperationalQueries");
    expect(read("lib/shift-query-invalidation.ts")).toContain('queryKey: ["shift-batch", batchId]');
    expect(read("lib/shift-query-invalidation.ts")).toContain('queryKey: ["shifts-feed"]');
  });
});
