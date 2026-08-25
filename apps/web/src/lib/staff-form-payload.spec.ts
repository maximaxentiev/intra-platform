import { describe, expect, it } from "vitest";
import {
  STAFF_UPDATE_FIELD_KEYS,
  buildStaffUpdatePayload,
  pickStaffFormEditableInitial,
  staffUpdatePayloadExcludesReadOnlyFields,
} from "./staff-form-payload";

describe("pickStaffFormEditableInitial", () => {
  it("ignores read-only staff response fields", () => {
    const editable = pickStaffFormEditableInitial({
      id: "staff-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      portalAccount: { accountStatus: "active", email: "a@example.test" },
      portalAccountStatus: "active",
      legalFirstName: "Alex",
      legalLastName: "Carer",
      legalName: "Alex Carer",
      displayName: "Alex C",
      useDisplayName: true,
      phone: "555",
      email: "alex@example.test",
      role: "ECA",
      notes: "Note",
      address: "1 Main St",
      city: "Toronto",
    });

    expect(editable).not.toHaveProperty("id");
    expect(editable).not.toHaveProperty("createdAt");
    expect(editable).not.toHaveProperty("updatedAt");
    expect(editable).not.toHaveProperty("portalAccount");
    expect(editable).not.toHaveProperty("status");
    expect(editable.city).toBe("Toronto");
  });
});

describe("buildStaffUpdatePayload", () => {
  const base = pickStaffFormEditableInitial({
    legalName: "Alex Carer",
    displayName: "Alex C",
    useDisplayName: true,
    phone: "555",
    email: "alex@example.test",
    role: "ECA",
    notes: "Note",
    address: "1 Main St",
    city: "Toronto",
  });

  it("includes only UpsertStaffDto fields", () => {
    const payload = buildStaffUpdatePayload({ ...base, city: "toronto" }, "Toronto");
    expect(payload).not.toBeNull();
    expect(Object.keys(payload!).sort()).toEqual([...STAFF_UPDATE_FIELD_KEYS].sort());
    expect(staffUpdatePayloadExcludesReadOnlyFields(payload!)).toBe(true);
  });

  it("excludes id, timestamps, portalAccount, and legacy employment status", () => {
    const payload = buildStaffUpdatePayload(base, "Toronto");
    expect(payload).toEqual({
      legalName: "Alex Carer",
      displayName: "Alex C",
      useDisplayName: true,
      phone: "555",
      email: "alex@example.test",
      role: "ECA",
      notes: "Note",
      address: "1 Main St",
      city: "Toronto",
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
    expect(payload).not.toHaveProperty("portalAccount");
    expect(payload).not.toHaveProperty("status");
  });

  it("normalizes changed city to canonical spelling", () => {
    const payload = buildStaffUpdatePayload({ ...base, city: "ottawa" }, "Toronto");
    expect(payload?.city).toBe("Ottawa");
  });

  it("allows unchanged legacy city values", () => {
    const payload = buildStaffUpdatePayload({ ...base, city: "Legacy Town" }, "Legacy Town");
    expect(payload?.city).toBe("Legacy Town");
  });

  it("rejects unsupported city changes", () => {
    expect(buildStaffUpdatePayload({ ...base, city: "Tornto" }, "Toronto")).toBeNull();
  });

  it("preserves other editable fields when city changes", () => {
    const payload = buildStaffUpdatePayload(
      { ...base, city: "Hamilton", phone: "999", notes: "Updated" },
      "Toronto",
    );
    expect(payload?.city).toBe("Hamilton");
    expect(payload?.phone).toBe("999");
    expect(payload?.notes).toBe("Updated");
  });

  it("does not include documentsUrl in normal staff update payload", () => {
    const payload = buildStaffUpdatePayload(base, "Toronto");
    expect(payload).not.toBeNull();
    expect(payload).not.toHaveProperty("documentsUrl");
    expect(Object.keys(payload!).sort()).toEqual([...STAFF_UPDATE_FIELD_KEYS].sort());
  });
});
