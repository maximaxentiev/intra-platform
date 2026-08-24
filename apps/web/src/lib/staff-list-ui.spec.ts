import { describe, expect, it } from "vitest";
import {
  EMPTY_STAFF_FILTERS,
  buildStaffFilterChips,
  clearStaffFilterChip,
  filterStaffList,
  hasActiveStaffFilters,
  staffContactLines,
  staffResultCountLabel,
} from "./staff-list-ui";
import type { Staff } from "./db";

const sample: Staff = {
  id: "s1",
  legalName: "Alex Carer",
  legalFirstName: "Alex",
  legalLastName: "Carer",
  displayName: "Alex C.",
  useDisplayName: true,
  phone: "416-555-0100",
  email: "alex@example.test",
  address: "1 Main St",
  city: "Toronto",
  role: "ECE",
  status: "active",
  notes: "",
  documentsUrl: "",
  createdAt: "",
  updatedAt: "",
  portalAccountStatus: "active",
  documentStatus: "approved",
};

describe("staff list filters", () => {
  it("filters live by name search across display and legal name only", () => {
    const list = [
      sample,
      { ...sample, id: "s2", legalName: "Jordan Lee", displayName: "", useDisplayName: false },
    ];
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, q: "alex" })).toHaveLength(1);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, q: "jordan" })).toHaveLength(1);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, q: "416" })).toHaveLength(0);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, q: "alex@example" })).toHaveLength(0);
  });

  it("builds chips only for non-default filters and clears individually", () => {
    const state = {
      ...EMPTY_STAFF_FILTERS,
      q: "Alex",
      status: "active" as const,
      role: "ECE",
      portal: "invited" as const,
    };
    expect(hasActiveStaffFilters(state)).toBe(true);
    const chips = buildStaffFilterChips(state);
    expect(chips.map((c) => c.id)).toEqual(["search", "status", "role", "portal"]);
    expect(clearStaffFilterChip(state, "role")).toMatchObject({ role: "all", q: "Alex" });
    expect(buildStaffFilterChips(EMPTY_STAFF_FILTERS)).toEqual([]);
  });

  it("formats result count label", () => {
    expect(staffResultCountLabel(3, 10)).toBe("Showing 3 of 10 staff");
  });
});

describe("staffContactLines", () => {
  it("prefers email as primary with phone secondary", () => {
    expect(staffContactLines(sample)).toEqual({
      primary: "alex@example.test",
      secondary: "416-555-0100",
    });
  });

  it("falls back to phone-only contact", () => {
    expect(staffContactLines({ email: "", phone: "416-555-0100" })).toEqual({
      primary: "416-555-0100",
      secondary: null,
    });
  });
});
