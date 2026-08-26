import { describe, expect, it } from "vitest";
import {
  EMPTY_SHIFT_FILTERS,
  buildShiftFilterChips,
  clearShiftFilterChip,
  formatShiftDateLabel,
  hasActiveShiftFilters,
  shiftAssigneeLabel,
  shiftCentreSelectionFromSearch,
  shiftCentreSelectionToApiQuery,
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
    const labels = buildShiftFilterChips({ ...base, centres: { mode: "all", centreIds: [] } }).map(
      (c) => c.label,
    );
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

  it("resolves multi-centre selection via lookups", () => {
    const centres = [
      { id: "c1", name: "Centre A" },
      { id: "c2", name: "Centre B" },
    ];
    const chips = buildShiftFilterChips(
      { ...base, centres: { mode: "subset", centreIds: ["c1", "c2"] } },
      { centres },
    );
    expect(chips[0]).toMatchObject({ id: "centre", label: "2 centres selected" });
  });

  it("shows centre name for single selection", () => {
    const chips = buildShiftFilterChips(
      { ...base, centres: { mode: "subset", centreIds: ["c1"] } },
      { centres: [{ id: "c1", name: "TEST CENTRE" }] },
    );
    expect(chips[0].label).toBe("TEST CENTRE");
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
    centres: { mode: "subset", centreIds: ["c1", "c2"] },
    status: "pending",
    staffId: "s1",
    staffpoint: "yes",
  };

  it("clears only the targeted filter", () => {
    expect(clearShiftFilterChip(applied, "centre")).toMatchObject({
      centres: { mode: "all", centreIds: [] },
      status: "pending",
    });
    expect(clearShiftFilterChip(applied, "dates")).toMatchObject({ from: "", to: "", centres: applied.centres });
    expect(clearShiftFilterChip(applied, "status").status).toBe("all");
    expect(clearShiftFilterChip(applied, "staff").staffId).toBe("all");
    expect(clearShiftFilterChip(applied, "staffpoint").staffpoint).toBe("all");
  });

  it("serializes multi-centre selection to centreIds URL param", () => {
    expect(shiftFiltersToSearch(applied)).toEqual({
      from: "2026-08-01",
      to: "2026-08-30",
      centreIds: "c1,c2",
      status: "pending",
      staff: "s1",
      staffpoint: "yes",
    });
  });

  it("omits defaults from the URL entirely", () => {
    expect(shiftFiltersToSearch(EMPTY_SHIFT_FILTERS)).toEqual({
      from: undefined,
      to: undefined,
      status: undefined,
      staff: undefined,
      staffpoint: undefined,
    });
  });

  it("clearing a chip then serializing drops just that param", () => {
    const next = clearShiftFilterChip(applied, "status");
    expect(shiftFiltersToSearch(next).status).toBeUndefined();
    expect(shiftFiltersToSearch(next).centreIds).toBe("c1,c2");
  });

  it("maps centre selection to API query params", () => {
    expect(shiftCentreSelectionToApiQuery(applied)).toEqual({ centreIds: ["c1", "c2"] });
    expect(shiftCentreSelectionToApiQuery(EMPTY_SHIFT_FILTERS)).toEqual({});
  });

  it("supports legacy single centre URL param", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const selection = shiftCentreSelectionFromSearch({ centre: id });
    expect(selection).toEqual({ mode: "subset", centreIds: [id] });
    expect(shiftFiltersToSearch({ ...EMPTY_SHIFT_FILTERS, centres: selection }).centreIds).toBe(id);
  });

  it("prefers centreIds over legacy centre when both present", () => {
    const idA = "11111111-1111-4111-8111-111111111111";
    const idB = "22222222-2222-4222-8222-222222222222";
    const selection = shiftCentreSelectionFromSearch({
      centreIds: `${idA},${idB}`,
      centre: idB,
    });
    expect(selection.centreIds).toEqual([idA, idB]);
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
