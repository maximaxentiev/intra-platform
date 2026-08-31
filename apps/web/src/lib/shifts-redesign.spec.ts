import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeCancellationReason } from "./shifts-lifecycle-ui";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const list = read("routes/_authenticated/shifts.index.tsx");
const feedList = read("components/shifts/ShiftsFeedList.tsx");
const detail = read("routes/_authenticated/shifts.$id.tsx");
const create = read("routes/_authenticated/shifts.new.tsx");
const comments = read("components/ShiftComments.tsx");
const resendDialog = read("components/shifts/ShiftResendConfirmationDialog.tsx");
const unassignDialog = read("components/shifts/ShiftUnassignDialog.tsx");
const cancelDialog = read("components/shifts/ShiftCancelDialog.tsx");
const activityPanel = read("components/shifts/ShiftActivityLogPanel.tsx");
const availableStaffList = read("components/shifts/ShiftAvailableStaffList.tsx");

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
    expect(list).toContain("CreateShiftActions");
  });

  it("orders desktop columns Centre, Date, Time, Role, Assigned to, Staffpoint, Filled", () => {
    const headerStart = feedList.indexOf("<TableHeader");
    const headerEnd = feedList.indexOf("</TableHeader>", headerStart);
    const headerBlock = feedList.slice(headerStart, headerEnd);
    const columns = ["Centre", "Date", "Time", "Role", "Assigned to", "Staffpoint", "Filled"];
    let lastIdx = -1;
    for (const col of columns) {
      const idx = headerBlock.indexOf(col);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });
});

describe("shift detail layout", () => {
  it("uses centre name only in the page header title", () => {
    expect(detail).toContain('title={shift.centreName ?? "Shift"}');
    expect(detail).not.toMatch(/PageHeader[\s\S]*meta=\{<StatusBadge/);
  });

  it("places Shift details before Assignment and Available staff", () => {
    expect(detail.indexOf('title="Shift details"')).toBeLessThan(detail.indexOf('id="assignment"'));
    expect(detail.indexOf('id="assignment"')).toBeLessThan(detail.indexOf('id="available-staff"'));
  });

  it("shows status in the Available staff header without a Status label", () => {
    expect(detail).toContain('id="available-staff"');
    expect(detail).toContain("Available staff");
    expect(detail).toContain("<StatusBadge status={shift.status}");
    expect(detail).not.toContain(">Status</p>");
    expect(detail).not.toContain("Eligible based on availability, conflicts, centre restrictions and compliance.");
  });

  it("places Cancel shift in the Available staff header action", () => {
    expect(detail).toContain("Cancel shift");
    expect(detail).not.toContain('title="Shift status"');
    expect(detail).not.toContain("Mark completed");
  });

  it("keeps Assignment focused on assignee controls only", () => {
    expect(detail).toContain("Assigned Carer");
    expect(detail).not.toContain("Assigned staff");
    expect(detail).not.toContain("This shift is staffed.");
  });

  it("keeps comments and activity log in the secondary rail without internal notes", () => {
    expect(detail).not.toContain("ShiftInternalNotesCard");
    expect(detail).not.toContain("shifts.notes");
    expect(detail).toContain("Shift Notes");
    expect(detail).toContain("confirmationNotes");
    expect(detail).toContain("<ShiftComments shiftId={id} />");
    expect(detail).toContain("ShiftActivityLogPanel");
    expect(detail).toContain("bg-surface-brand-dusk");
    expect(detail).not.toContain("text-info-foreground");
    expect(detail.indexOf("<ShiftComments shiftId={id} />")).toBeLessThan(
      detail.indexOf("<ShiftActivityLogPanel shiftId={id} />"),
    );
  });

  it("declares edit centre contacts query before the loading early return", () => {
    const earlyReturn = detail.indexOf("if (!shift) return <DetailLoading />");
    const editContactsQuery = detail.indexOf('queryKey: ["centre-contacts", editValsForQueries.centreId]');
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(editContactsQuery).toBeGreaterThan(-1);
    expect(editContactsQuery).toBeLessThan(earlyReturn);
  });

  it("uses a desktop grid row for available staff", () => {
    expect(detail).toContain("ShiftAvailableStaffList");
    expect(availableStaffList).toContain("md:grid-cols-[minmax(8rem,1.05fr)_minmax(0,2.5fr)_5rem_auto_auto]");
    expect(availableStaffList).toContain("formatAvailableStaffPriorityLine(s)");
    expect(availableStaffList).toContain("md:hidden");
  });

  it("wires communication dialogs instead of immediate send/unassign", () => {
    expect(detail).toContain("ShiftResendConfirmationDialog");
    expect(detail).toContain("ShiftUnassignDialog");
    expect(detail).toContain("ShiftCancelDialog");
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
    expect(resendDialog).toContain("Resend confirmation");
  });

  it("cancel dialog requires reason and optional communication", () => {
    expect(cancelDialog).toContain("Cancellation reason *");
    expect(cancelDialog).toContain("Cancel shift");
  });
});

describe("shift activity log panel", () => {
  it("filters by shift and paginates ten entries", () => {
    expect(activityPanel).toContain("shiftId");
    expect(activityPanel).toContain("PAGE_SIZE = 10");
  });

  it("uses the vertical shift activity feed instead of the reports table", () => {
    expect(activityPanel).toContain("ShiftActivityFeed");
    expect(activityPanel).not.toContain("ActivityLogList");
    expect(activityPanel).toContain("min-w-0");
  });
});

describe("create shift redesign", () => {
  it("uses Shift Notes backed by confirmationNotes instead of legacy notes", () => {
    expect(create).toContain("ShiftNotesField");
    expect(create).toContain("confirmationNotes");
    expect(create).not.toContain('htmlFor="notes"');
    expect(create).not.toContain("notes:");
    expect(create).toContain('{saving ? "Creating..." : "Create shift"}');
  });

  it("omits Where / When / Requirements category headings from the create form", () => {
    expect(create).not.toContain('legend="Where"');
    expect(create).not.toContain('legend="When"');
    expect(create).not.toContain('legend="Requirements"');
    expect(create).toContain("Centre *");
    expect(create).toContain("Role required *");
  });
});

describe("internal comments component", () => {
  it("uses shift_comments API distinct from shifts.notes", () => {
    expect(comments).toContain("shiftsApi.addComment(shiftId, trimmed)");
    expect(comments).toContain('queryKey: ["shift-comments", shiftId]');
    expect(comments).not.toContain("shiftsApi.update");
    expect(comments).toContain('title="Internal comments"');
    expect(comments).not.toContain("Notes and updates visible only to Ops.");
  });

  it("uses readable foreground tokens inside the white card", () => {
    expect(comments).toContain('className="text-foreground"');
    expect(comments).toContain("placeholder:text-muted-foreground");
    expect(comments).toContain("text-muted-foreground");
  });
});
