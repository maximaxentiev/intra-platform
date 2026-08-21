import { describe, expect, it } from "vitest";
import {
  EMPTY_SHIFT_FILTERS,
  buildShiftFilterChips,
  clearShiftFilterChip,
  formatShiftDateLabel,
  hasActiveShiftFilters,
  shiftAssigneeLabel,
  shiftFiltersToSearch,
  shiftResultCountLabel,
  type ShiftFilterState,
} from "./shifts-list-ui";

const base: ShiftFilterState = { ...EMPTY_SHIFT_FILTERS };

describe("shift filter chips", () => {
  it("produces no chips for default filters", () => {
    expect(buildShiftFilterChips(base)).toEqual([]);
    expect(hasActiveShiftFilters(base)).toBe(false);
  });

  it("never renders meaningless 'All centres' / 'All statuses' chips", () => {
    const labels = buildShiftFilterChips({ ...base, centreId: "all", status: "all" }).map((c) => c.label);
    expect(labels).not.toContain("All centres");
    expect(labels).not.toContain("All statuses");
  });

  it("renders a single readable date range chip", () => {
    const chips = buildShiftFilterChips({ ...base, from: "2026-08-01", to: "2026-08-30" });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "dates", field: "Dates", label: "Aug 1 – Aug 30" });
  });

  it("supports open-ended ranges", () => {
    expect(buildShiftFilterChips({ ...base, from: "2026-08-01" })[0].label).toBe("From Aug 1");
    expect(buildShiftFilterChips({ ...base, to: "2026-08-30" })[0].label).toBe("Until Aug 30");
  });

  it("resolves centre and staff names via lookups", () => {
    const chips = buildShiftFilterChips(
      { ...base, centreId: "c1", staffId: "s1" },
      { centreName: () => "TEST CENTRE", staffName: () => "Max" },
    );
    expect(chips.map((c) => c.label)).toEqual(["TEST CENTRE", "Max"]);
  });

  it("falls back gracefully when a lookup has not loaded", () => {
    const chips = buildShiftFilterChips({ ...base, centreId: "c1" });
    expect(chips[0].label).toBe("Selected centre");
  });

  it("labels status and staffpoint chips", () => {
    const chips = buildShiftFilterChips({ ...base, status: "pending", staffpoint: "yes" });
    expect(chips.map((c) => c.label)).toEqual(["Pending", "Added"]);
  });

  it("does not shift dates across timezones", () => {
    expect(formatShiftDateLabel("2026-01-01")).toBe("Jan 1");
  });
});

describe("removing filters preserves the search schema", () => {
  const applied: ShiftFilterState = {
    from: "2026-08-01",
    to: "2026-08-30",
    centreId: "c1",
    status: "pending",
    staffId: "s1",
    staffpoint: "yes",
  };

  it("clears only the targeted filter", () => {
    expect(clearShiftFilterChip(applied, "centre")).toMatchObject({ centreId: "all", status: "pending" });
    expect(clearShiftFilterChip(applied, "dates")).toMatchObject({ from: "", to: "", centreId: "c1" });
    expect(clearShiftFilterChip(applied, "status").status).toBe("all");
    expect(clearShiftFilterChip(applied, "staff").staffId).toBe("all");
    expect(clearShiftFilterChip(applied, "staffpoint").staffpoint).toBe("all");
  });

  it("serializes to the existing URL param names", () => {
    expect(shiftFiltersToSearch(applied)).toEqual({
      from: "2026-08-01",
      to: "2026-08-30",
      centre: "c1",
      status: "pending",
      staff: "s1",
      staffpoint: "yes",
    });
  });

  it("omits defaults from the URL entirely", () => {
    expect(shiftFiltersToSearch(EMPTY_SHIFT_FILTERS)).toEqual({
      from: undefined,
      to: undefined,
      centre: undefined,
      status: undefined,
      staff: undefined,
      staffpoint: undefined,
    });
  });

  it("clearing a chip then serializing drops just that param", () => {
    const next = clearShiftFilterChip(applied, "status");
    expect(shiftFiltersToSearch(next).status).toBeUndefined();
    expect(shiftFiltersToSearch(next).centre).toBe("c1");
  });
});

describe("result count", () => {
  it("uses singular copy for one shift", () => {
    expect(shiftResultCountLabel(1)).toBe("1 shift");
    expect(shiftResultCountLabel(3)).toBe("3 shifts");
    expect(shiftResultCountLabel(0)).toBe("0 shifts");
  });
});

describe("assignee copy", () => {
  it("reads as actionable for pending unassigned shifts", () => {
    expect(shiftAssigneeLabel(null, "pending")).toEqual({ text: "Needs staff", needsStaff: true });
  });

  it("stays quiet for historical unassigned shifts", () => {
    expect(shiftAssigneeLabel(null, "cancelled")).toEqual({ text: "Unassigned", needsStaff: false });
    expect(shiftAssigneeLabel(null, "completed").needsStaff).toBe(false);
  });

  it("shows the assigned name when present", () => {
    expect(shiftAssigneeLabel("Max", "filled")).toEqual({ text: "Max", needsStaff: false });
  });
});
