import { describe, expect, it } from "vitest";
import {
  countCompletedOnboardingSteps,
  onboardingStepStateLabel,
  resolveOnboardingStepDisplayState,
} from "./carer-onboarding-progress";
import { carerSessionFixture } from "./carer-session-fixtures";

describe("resolveOnboardingStepDisplayState", () => {
  it("shows step 2 complete from documentsComplete not onboardingStep", () => {
    const ctx = {
      activeStep: 3,
      profileComplete: true,
      documentsComplete: true,
      availabilityComplete: false,
      profileCompletedAt: "2026-01-01T00:00:00.000Z",
      onboardingStep: 2,
    };
    expect(resolveOnboardingStepDisplayState(2, ctx)).toBe("complete");
  });

  it("shows step 3 complete from availabilityComplete", () => {
    const ctx = {
      activeStep: 3,
      profileComplete: true,
      documentsComplete: true,
      availabilityComplete: true,
      profileCompletedAt: "2026-01-01T00:00:00.000Z",
      onboardingStep: 3,
    };
    expect(resolveOnboardingStepDisplayState(3, ctx)).toBe("complete");
  });

  it("locks step 3 when documents incomplete", () => {
    const ctx = {
      activeStep: 3,
      profileComplete: true,
      documentsComplete: false,
      availabilityComplete: false,
      profileCompletedAt: "2026-01-01T00:00:00.000Z",
      onboardingStep: 3,
    };
    expect(resolveOnboardingStepDisplayState(3, ctx)).toBe("locked");
  });
});

describe("countCompletedOnboardingSteps", () => {
  it("counts from session booleans only", () => {
    expect(
      countCompletedOnboardingSteps(
        carerSessionFixture({
          profileComplete: true,
          documentsComplete: true,
          availabilityComplete: false,
        }),
      ),
    ).toBe(2);
  });
});

describe("onboardingStepStateLabel", () => {
  it('labels locked steps as "Locked"', () => {
    expect(onboardingStepStateLabel("locked", 2, 1)).toBe("Locked");
  });
});
