import { describe, expect, it } from "vitest";
import {
  personalProfileDirty,
  trimPersonalProfile,
  validatePersonalProfileFields,
} from "./carer-personal-profile";

describe("validatePersonalProfileFields", () => {
  it("requires all step 1 fields", () => {
    const errors = validatePersonalProfileFields({
      legalFirstName: "",
      legalLastName: "Lee",
      email: "bad",
      phone: "",
      address: "",
      city: "",
    });
    expect(errors.legalFirstName).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });
});

describe("trimPersonalProfile", () => {
  it("trims and lowercases email", () => {
    expect(
      trimPersonalProfile({
        legalFirstName: " A ",
        legalLastName: " B ",
        email: " X@Y.Z ",
        phone: " 1 ",
        address: " 2 ",
        city: " 3 ",
      }).email,
    ).toBe("x@y.z");
  });
});

describe("personalProfileDirty", () => {
  it("detects edits", () => {
    const a = {
      legalFirstName: "A",
      legalLastName: "B",
      email: "a@b.c",
      phone: "1",
      address: "2",
      city: "3",
    };
    expect(personalProfileDirty({ ...a, phone: "9" }, a)).toBe(true);
    expect(personalProfileDirty(a, a)).toBe(false);
  });
});
