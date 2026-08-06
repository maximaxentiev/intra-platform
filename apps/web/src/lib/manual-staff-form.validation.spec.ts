import { describe, expect, it } from "vitest";
import { validateManualStaffForm } from "./manual-staff-form.validation";

describe("validateManualStaffForm", () => {
  const valid = {
    displayName: "Alex Carer",
    legalFirstName: "Alex",
    legalLastName: "Carer",
    email: "alex@example.test",
    phone: "4165550100",
    address: "123 Main St",
    city: "Toronto",
  };

  it("accepts valid input", () => {
    expect(validateManualStaffForm(valid)).toEqual({});
  });

  it("returns field errors for missing required fields", () => {
    const errors = validateManualStaffForm({ ...valid, email: "  ", city: "" });
    expect(errors.email).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });

  it("rejects invalid email", () => {
    expect(validateManualStaffForm({ ...valid, email: "not-an-email" }).email).toBeTruthy();
  });
});
