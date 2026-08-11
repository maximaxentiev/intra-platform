import { describe, expect, it } from "vitest";
import { validateManualStaffForm, MANUAL_STAFF_ROLES } from "./manual-staff-form.validation";

describe("validateManualStaffForm", () => {
  const valid = {
    displayName: "Alex Carer",
    legalFirstName: "Alex",
    legalLastName: "Carer",
    role: "ECA" as const,
    email: "alex@example.test",
    phone: "4165550100",
    address: "123 Main St",
    city: "Toronto",
  };

  it("accepts valid input", () => {
    expect(validateManualStaffForm(valid)).toEqual({});
  });

  it.each(MANUAL_STAFF_ROLES)("accepts role %s", (role) => {
    expect(validateManualStaffForm({ ...valid, role })).toEqual({});
  });

  it("returns field errors for missing required fields", () => {
    const errors = validateManualStaffForm({ ...valid, email: "  ", city: "" });
    expect(errors.email).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });

  it("rejects missing role", () => {
    expect(validateManualStaffForm({ ...valid, role: "" }).role).toBeTruthy();
  });

  it("rejects unknown role", () => {
    expect(validateManualStaffForm({ ...valid, role: "Teacher" as "ECA" }).role).toBeTruthy();
  });

  it("rejects invalid email", () => {
    expect(validateManualStaffForm({ ...valid, email: "not-an-email" }).email).toBeTruthy();
  });

  it("rejects unsupported city", () => {
    expect(validateManualStaffForm({ ...valid, city: "Tornto" }).city).toMatch(
      /supported city list/i,
    );
  });
});
