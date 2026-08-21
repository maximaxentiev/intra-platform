import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const list = read("routes/_authenticated/shifts.index.tsx");
const detail = read("routes/_authenticated/shifts.$id.tsx");
const create = read("routes/_authenticated/shifts.new.tsx");
const comments = read("components/ShiftComments.tsx");

describe("shifts list redesign", () => {
  it("keeps the page header and dominant create action", () => {
    expect(list).toContain('title="Shifts"');
    expect(list).toContain('subtitle="All shifts across every centre."');
    expect(list).toContain('<Link to="/shifts/new">');
    expect(list).toContain("Create shift");
  });

  it("preserves the Zod search schema and URL param names", () => {
    for (const param of ["from", "to", "centre", "status", "staff", "staffpoint"]) {
      expect(list).toContain(`  ${param}:`);
    }
    expect(list).toContain("validateSearch: (s) => searchSchema.parse(s)");
  });

  it("keeps explicit Apply filters behaviour (no live filtering)", () => {
    expect(list).toContain('applyLabel="Apply filters"');
    expect(list).toContain("function applyFilters");
    expect(list).toContain("navigate({ search: shiftFiltersToSearch(state) })");
  });

  it("adopts FilterPanel and FilterChipBar", () => {
    expect(list).toContain("FilterPanel");
    expect(list).toContain("FilterChipBar");
    expect(list).toContain("buildShiftFilterChips");
  });

  it("keeps a desktop table using the shared DataTable conventions", () => {
    expect(list).toContain("dataTable.shell");
    expect(list).toContain("dataTable.rowInteractive");
    expect(list).toContain("DataTableLoadingRows");
    for (const col of ["Date", "Centre", "Time", "Role", "Assigned to", "Staffpoint", "Status"]) {
      expect(list).toContain(`>${col}`);
    }
  });

  it("makes rows navigable with an accessible link and chevron", () => {
    expect(list).toContain('to="/shifts/$id"');
    expect(list).toContain("aria-label={`Open shift at ${s.centreName} on ${s.shiftDate}`}");
    expect(list).toContain("ChevronRight");
  });

  it("uses actionable copy instead of faint italic Unassigned", () => {
    expect(list).toContain("shiftAssigneeLabel");
    expect(list).not.toContain("italic");
  });

  it("shows distinct empty states and never swallows errors as zero results", () => {
    expect(list).toContain("No shifts yet");
    expect(list).toContain("No shifts match these filters");
    expect(list).toContain("Clear filters");
    expect(list).toContain("Shifts could not be loaded");
    expect(list).toContain("Retry");
  });

  it("provides a mobile filter sheet and card list", () => {
    expect(list).toContain("SheetContent");
    expect(list).toContain('side="bottom"');
    expect(list).toContain("md:hidden");
  });

  it("explains Staffpoint without renaming it", () => {
    expect(list).toContain("STAFFPOINT_HELP");
    expect(list).toContain("Staffpoint");
  });
});

describe("shift detail redesign", () => {
  it("keeps assignment as the primary pending workflow", () => {
    expect(detail).toContain('title={assignedName ? "Assignment" : "Available staff"}');
    expect(detail).toContain("Eligible based on availability, conflicts, centre restrictions and compliance.");
  });

  it("preserves assignment behaviour and feedback wiring", () => {
    expect(detail).toContain("shiftAssignmentFeedbackMessage");
    expect(detail).toContain("assigningStaffId");
    expect(detail).toContain("err.status === 409");
    expect(detail).toContain('["shift-available", id]');
    expect(detail).toContain("availableQ.data ?? []");
  });

  it("labels top staff inline instead of using a legend", () => {
    expect(detail).toContain("Top staff");
    expect(detail).not.toContain("= Top staff\n");
  });

  it("keeps a labelled contacted control and accessible assign action", () => {
    expect(detail).toContain("aria-label={`Mark ${displayStaff(s)} as contacted`}");
    expect(detail).toContain("aria-label={`Assign ${displayStaff(s)} to this shift`}");
    expect(detail).toContain("toggleContacted");
  });

  it("keeps the no-eligible-staff copy and links team availability", () => {
    expect(detail).toContain("No eligible staff found for this shift.");
    expect(detail).toContain("document compliance are considered automatically");
    expect(detail).toContain('<Link to="/availability">Team availability</Link>');
  });

  it("keeps filled-state assignment prominent with resend and unassign", () => {
    expect(detail).toContain("Assigned staff");
    expect(detail).toContain("Resend confirmations");
    expect(detail).toContain("Unassign");
  });

  it("presents lifecycle-aware status copy instead of a free-form select", () => {
    expect(detail).toContain("Pending until staff is assigned.");
    expect(detail).toContain("Staff assigned.");
    expect(detail).toContain("Automatically completed after the scheduled end time.");
    expect(detail).toContain("Filled shifts are automatically marked Completed once their end time passes.");
  });

  it("keeps cancellation accessible with an optional reason", () => {
    expect(detail).toContain("Cancel shift");
    expect(detail).toContain('changeStatus("cancelled", reason)');
    expect(detail).toContain("cancel-reason");
  });

  it("moves delete into an overflow menu with a destructive confirmation", () => {
    expect(detail).toContain('aria-label="More shift actions"');
    expect(detail).toContain("Delete shift");
    expect(detail).toContain("ConfirmDestructiveDialog");
  });

  it("uses PropertyList for supporting details and keeps inline edit", () => {
    expect(detail).toContain("PropertyList");
    expect(detail).toContain('setEditing((v) => !v)');
    expect(detail).toContain("saveEdits");
    for (const legend of ["Where", "When", "Requirements", "Internal"]) {
      expect(detail).toContain(`legend="${legend}"`);
    }
  });
});

describe("create shift redesign", () => {
  it("groups fields as Where / When / Requirements / Internal", () => {
    for (const legend of ["Where", "When", "Requirements", "Internal"]) {
      expect(create).toContain(`legend="${legend}"`);
    }
  });

  it("keeps the create-then-assign explanation", () => {
    expect(create).toContain("Create the shift first, then find and assign staff on the next screen.");
  });

  it("renames the submit action to Create shift", () => {
    expect(create).toContain('{saving ? "Creating..." : "Create shift"}');
    expect(create).not.toContain("Save shift");
  });

  it("preserves the create request, validation and redirect", () => {
    expect(create).toContain("shiftsApi.create(");
    expect(create).toContain('startTime: values.startTime + ":00"');
    expect(create).toContain('toast.error("Please pick a centre")');
    expect(create).toContain('navigate({ to: "/shifts/$id", params: { id: created.id } })');
    expect(create).toContain("SearchableCentreSelect");
  });
});

describe("internal comments redesign", () => {
  it("uses a compact composer that expands on activation", () => {
    expect(comments).toContain("Add a comment…");
    expect(comments).toContain("setComposing(true)");
    expect(comments).toContain("Add comment");
  });

  it("keeps the existing comment API behaviour", () => {
    expect(comments).toContain("shiftsApi.addComment(shiftId, trimmed)");
    expect(comments).toContain('queryKey: ["shift-comments", shiftId]');
  });
});
