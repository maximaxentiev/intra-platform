import { describe, expect, it } from "vitest";
import {
  carerLandingPath,
  carerOnboardingResumePath,
  isOnboardingStepNavigable,
  maxAccessibleOnboardingStep,
  stepPathForNumber,
} from "./carer-onboarding";
import { carerSessionFixture } from "./carer-session-fixtures";

describe("carerOnboardingResumePath", () => {
  it("starts at profile when step 1 incomplete", () => {
    expect(carerOnboardingResumePath(carerSessionFixture())).toBe("/carer/onboarding/profile");
  });
});

describe("carerLandingPath", () => {
  it("sends incomplete users to onboarding hub", () => {
    expect(carerLandingPath(carerSessionFixture())).toBe("/carer/onboarding");
  });

  it("sends complete users to portal home", () => {
    expect(
      carerLandingPath(
        carerSessionFixture({
          onboardingCompletedAt: "2026-01-02T00:00:00.000Z",
          onboardingComplete: true,
        }),
      ),
    ).toBe("/carer");
  });
});

describe("maxAccessibleOnboardingStep", () => {
  it("blocks documents before profile completion", () => {
    expect(maxAccessibleOnboardingStep(carerSessionFixture())).toBe(1);
  });

  it("allows all three steps after documents step completion", () => {
    expect(
      maxAccessibleOnboardingStep(
        carerSessionFixture({
          profileCompletedAt: "2026-01-01T00:00:00.000Z",
          onboardingStep: 3,
        }),
      ),
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
});

describe("stepPathForNumber", () => {
  it("maps documents to the canonical onboarding route", () => {
    expect(stepPathForNumber(2)).toBe("/carer/onboarding/documents");
  });
});
