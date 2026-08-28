import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeCancellationReason } from "./shifts-lifecycle-ui";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const list = read("routes/_authenticated/shifts.index.tsx");
const detail = read("routes/_authenticated/shifts.$id.tsx");
const create = read("routes/_authenticated/shifts.new.tsx");
const comments = read("components/ShiftComments.tsx");
const resendDialog = read("components/shifts/ShiftResendConfirmationDialog.tsx");
const unassignDialog = read("components/shifts/ShiftUnassignDialog.tsx");
const cancelDialog = read("components/shifts/ShiftCancelDialog.tsx");
const activityPanel = read("components/shifts/ShiftActivityLogPanel.tsx");
const notesCard = read("components/shifts/ShiftInternalNotesCard.tsx");

describe("shift cancellation reason", () => {
  it("accepts trimmed non-empty reasons", () => {
    expect(normalizeCancellationReason("  Centre closed  ")).toBe("Centre closed");
  });

  it("rejects blank and whitespace-only reasons", () => {
    expect(normalizeCancellationReason("")).toBeNull();
    expect(normalizeCancellationReason("   ")).toBeNull();
    expect(normalizeCancellationReason("\n\t")).toBeNull();
  });
});

describe("shifts list redesign", () => {
  it("keeps the page header and dominant create action", () => {
    expect(list).toContain('title="Shifts"');
    expect(list).not.toContain("All shifts across every centre");
    expect(list).toContain('<Link to="/shifts/new">');
    expect(list).toContain("Create shift");
  });

  it("orders desktop columns Centre, Date, Time, Role, Assigned to, Staffpoint, Filled", () => {
    const headerStart = list.indexOf("<TableHeader");
    const headerEnd = list.indexOf("</TableHeader>", headerStart);
    const headerBlock = list.slice(headerStart, headerEnd);
    const columns = ["Centre", "Date", "Time", "Role", "Assigned to", "Staffpoint", "Filled"];
    let lastIdx = -1;
    for (const col of columns) {
      const idx = headerBlock.indexOf(col);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it("preserves the Zod search schema and URL param names", () => {
    for (const param of ["from", "to", "centre", "centreIds", "status", "staff", "staffpoint"]) {
      expect(list).toContain(`  ${param}:`);
    }
    expect(list).toContain("validateSearch: (s) => searchSchema.parse(s)");
    expect(list).toContain("ReportCentreMultiSelect");
  });

  it("keeps explicit Apply filters behaviour (no live filtering)", () => {
    expect(list).toContain('applyLabel="Apply filters"');
    expect(list).toContain("function applyFilters");
    expect(list).toContain("navigate({ search: shiftFiltersToSearch(state) })");
  });

  it("makes rows navigable with an accessible link and chevron", () => {
    expect(list).toContain('to="/shifts/$id"');
    expect(list).toContain("aria-label={`Open shift at ${s.centreName} on ${s.shiftDate}`}");
    expect(list).toContain("ChevronRight");
  });
});

describe("shift detail layout", () => {
  it("uses centre name only in the page header title", () => {
    expect(detail).toContain('title={shift.centreName ?? "Shift"}');
    expect(detail).not.toMatch(/PageHeader[\s\S]*meta=\{<StatusBadge/);
  });

  it("places Shift details before Assignment", () => {
    expect(detail.indexOf('title="Shift details"')).toBeLessThan(
      detail.indexOf('title={assignedName ? "Assignment"'),
    );
  });

  it("merges status into Assignment and uses Assigned Carer label", () => {
    expect(detail).toContain("Assigned Carer");
    expect(detail).not.toContain("Assigned staff");
    expect(detail).toContain("Status");
    expect(detail).not.toContain("This shift is staffed.");
    expect(detail).not.toContain("Mark completed");
    expect(detail).not.toContain('title="Shift status"');
  });

  it("places internal notes and activity log in the secondary rail", () => {
    expect(detail).toContain("ShiftInternalNotesCard");
    expect(detail).toContain("ShiftActivityLogPanel");
    expect(detail).toContain("bg-surface-muted");
  });

  it("wires communication dialogs instead of immediate send/unassign", () => {
    expect(detail).toContain("ShiftResendConfirmationDialog");
    expect(detail).toContain("ShiftUnassignDialog");
    expect(detail).toContain("ShiftCancelDialog");
    expect(detail).toContain("setResendDialogOpen(true)");
    expect(detail).toContain("setUnassignDialogOpen(true)");
    expect(detail).toContain("setCancelDialogOpen(true)");
    expect(detail).not.toContain("resendAssignmentConfirmation(id)");
    expect(detail).toContain("resendAssignmentConfirmation(id, recipients)");
    expect(detail).toContain("confirmUnassign()");
  });

  it("preserves assignment confirmation dialog workflow", () => {
    expect(detail).toContain("ShiftAssignmentConfirmDialog");
    expect(detail).toContain("confirmAssignStaff");
  });
});

describe("shift communication dialogs", () => {
  it("resend dialog asks before sending and supports recipient selection", () => {
    expect(resendDialog).toContain("Send confirmation communication?");
    expect(resendDialog).toContain("No / Cancel");
    expect(resendDialog).toContain("Resend confirmation");
    expect(resendDialog).toContain("ShiftRecipientCheckboxes");
  });

  it("unassign dialog supports no-email and recipient selection", () => {
    expect(unassignDialog).toContain("Save without email");
    expect(unassignDialog).toContain("Send communication");
    expect(unassignDialog).toContain("Confirm unassign");
  });

  it("cancel dialog requires reason and optional communication", () => {
    expect(cancelDialog).toContain("Cancellation reason *");
    expect(cancelDialog).toContain("No communication");
    expect(cancelDialog).toContain("Send communication");
    expect(cancelDialog).toContain("Cancel shift");
  });
});

describe("shift activity log panel", () => {
  it("filters by shift and paginates ten entries", () => {
    expect(activityPanel).toContain("shiftId");
    expect(activityPanel).toContain("PAGE_SIZE = 10");
    expect(activityPanel).toContain("Previous");
    expect(activityPanel).toContain("Next");
  });
});

describe("shift internal notes", () => {
  it("persists via shifts API update", () => {
    expect(notesCard).toContain("Internal notes");
    expect(notesCard).toContain("Ops-only notes");
    expect(notesCard).toContain("shiftsApi.update(shiftId, { notes })");
  });
});

describe("create shift redesign", () => {
  it("groups fields as Where / When / Requirements / Internal", () => {
    for (const legend of ["Where", "When", "Requirements", "Internal"]) {
      expect(create).toContain(`legend="${legend}"`);
    }
  });

  it("renames the submit action to Create shift", () => {
    expect(create).toContain('{saving ? "Creating..." : "Create shift"}');
  });
});

describe("internal comments component", () => {
  it("keeps the existing comment API behaviour", () => {
    expect(comments).toContain("shiftsApi.addComment(shiftId, trimmed)");
    expect(comments).toContain('queryKey: ["shift-comments", shiftId]');
  });
});
