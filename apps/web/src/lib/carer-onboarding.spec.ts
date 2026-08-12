import { describe, expect, it } from "vitest";
import {
  carerLandingPath,
  carerOnboardingResumePath,
  isOnboardingStepNavigable,
  maxAccessibleOnboardingStep,
  stepPathForNumber,
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

  it("allows all three steps after documents step completion", () => {
    expect(
      maxAccessibleOnboardingStep({
        ...base,
        profileCompletedAt: "2026-01-01T00:00:00.000Z",
        onboardingStep: 3,
      }),
    ).toBe(3);
  });
});

describe("isOnboardingStepNavigable", () => {
  const step3Session = {
    profileCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingStep: 3,
  };

  it("allows revisiting profile and documents from step 3", () => {
    expect(isOnboardingStepNavigable(1, 3, step3Session)).toBe(true);
    expect(isOnboardingStepNavigable(2, 3, step3Session)).toBe(true);
    expect(isOnboardingStepNavigable(3, 3, step3Session)).toBe(false);
  });

  it("allows profile navigation from documents but not availability", () => {
    expect(
      isOnboardingStepNavigable(1, 2, {
        ...step3Session,
        onboardingStep: 2,
      }),
    ).toBe(true);
    expect(
      isOnboardingStepNavigable(2, 2, {
        ...step3Session,
        onboardingStep: 2,
      }),
    ).toBe(false);
    expect(
      isOnboardingStepNavigable(3, 2, {
        ...step3Session,
        onboardingStep: 2,
      }),
    ).toBe(false);
  });

  it("locks future steps before profile completion", () => {
    expect(isOnboardingStepNavigable(2, 1, base)).toBe(false);
    expect(isOnboardingStepNavigable(3, 1, base)).toBe(false);
  });
});

describe("stepPathForNumber", () => {
  it("maps documents to the canonical onboarding route", () => {
    expect(stepPathForNumber(2)).toBe("/carer/onboarding/documents");
  });
});
