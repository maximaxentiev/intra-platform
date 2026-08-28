import { describe, expect, it } from "vitest";
import {
  EMPTY_STAFF_FILTERS,
  buildStaffFilterChips,
  clearStaffFilterChip,
  filterStaffList,
  hasActiveStaffFilters,
  staffContactLines,
  staffDocumentListStatusOf,
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
  notes: "",
  documentsUrl: "",
  createdAt: "",
  updatedAt: "",
  portalAccountStatus: "active",
  documentStatus: "approved",
};

function staffWithStatus(status: string, overrides: Partial<Staff> = {}): Staff {
  return { ...sample, id: `s-${status}`, documentStatus: status, ...overrides };
}

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

  it("filters by server-computed document status aggregate", () => {
    const list = [
      staffWithStatus("approved"),
      staffWithStatus("pending_review", { id: "s-pending" }),
      staffWithStatus("expiring_soon", { id: "s-expiring" }),
      staffWithStatus("expired", { id: "s-expired" }),
      staffWithStatus("no_documents_submitted", { id: "s-missing" }),
    ];
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "approved" })).toHaveLength(1);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "pending_review" })).toHaveLength(1);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "expiring_soon" })).toHaveLength(1);
    expect(filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "expired" })).toHaveLength(1);
    expect(
      filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "no_documents_submitted" }),
    ).toHaveLength(1);
    expect(filterStaffList(list, EMPTY_STAFF_FILTERS)).toHaveLength(5);
  });

  it("combines document status filter with search", () => {
    const list = [
      staffWithStatus("approved", { id: "s1", legalName: "Ready Alex", displayName: "", useDisplayName: false }),
      staffWithStatus("approved", { id: "s2", legalName: "Ready Jordan", displayName: "", useDisplayName: false }),
      staffWithStatus("pending_review", { id: "s3", legalName: "Pending Alex", displayName: "", useDisplayName: false }),
    ];
    const filtered = filterStaffList(list, {
      ...EMPTY_STAFF_FILTERS,
      q: "alex",
      documents: "approved",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.legalName).toBe("Ready Alex");
  });

  it("treats missing documentStatus as no_documents_submitted", () => {
    const list = [{ ...sample, documentStatus: undefined }];
    expect(staffDocumentListStatusOf(list[0]!)).toBe("no_documents_submitted");
    expect(
      filterStaffList(list, { ...EMPTY_STAFF_FILTERS, documents: "no_documents_submitted" }),
    ).toHaveLength(1);
  });

  it("builds chips only for non-default filters and clears individually", () => {
    const state = {
      ...EMPTY_STAFF_FILTERS,
      q: "Alex",
      role: "ECE",
      portal: "invited" as const,
      documents: "expired" as const,
    };
    expect(hasActiveStaffFilters(state)).toBe(true);
    const chips = buildStaffFilterChips(state);
    expect(chips.map((c) => c.id)).toEqual(["search", "role", "portal", "documents"]);
    expect(clearStaffFilterChip(state, "documents")).toMatchObject({ documents: "all", q: "Alex" });
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
