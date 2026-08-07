import { describe, expect, it } from "vitest";
import {
  carerLandingPath,
  carerOnboardingResumePath,
  maxAccessibleOnboardingStep,
} from "./carer-onboarding";
import type { CarerSession } from "./carer";

const base: CarerSession = {
  accountId: "a",
  staffId: "s",
  email: "c@example.test",
  status: "incomplete",
  onboardingStep: 1,
  profileCompletedAt: null,
  onboardingCompletedAt: null,
  legalFirstName: "A",
  legalLastName: "B",
  phone: "1",
  address: "1",
  city: "C",
};

describe("carerOnboardingResumePath", () => {
  it("starts at profile when step 1 incomplete", () => {
    expect(carerOnboardingResumePath(base)).toBe("/carer/onboarding/profile");
  });

  it("resumes at documents after step 1", () => {
    expect(
      carerOnboardingResumePath({
        ...base,
        profileCompletedAt: "2026-01-01T00:00:00.000Z",
        onboardingStep: 2,
      }),
    ).toBe("/carer/onboarding/documents");
  });
});

describe("carerLandingPath", () => {
  it("sends incomplete users to onboarding", () => {
    expect(carerLandingPath(base)).toBe("/carer/onboarding/profile");
  });

  it("sends complete users to portal home", () => {
    expect(
      carerLandingPath({ ...base, onboardingCompletedAt: "2026-01-02T00:00:00.000Z" }),
    ).toBe("/carer");
  });
});

describe("maxAccessibleOnboardingStep", () => {
  it("blocks documents before profile completion", () => {
    expect(maxAccessibleOnboardingStep(base)).toBe(1);
  });
});
