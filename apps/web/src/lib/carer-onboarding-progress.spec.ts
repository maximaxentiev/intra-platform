import { describe, expect, it } from "vitest";
import {
  countCompletedOnboardingSteps,
  onboardingStepStateLabel,
  resolveOnboardingStepDisplayState,
} from "./carer-onboarding-progress";

const step1Complete = {
  activeStep: 1,
  profileCompletedAt: "2026-01-01T00:00:00.000Z",
  onboardingStep: 2,
  onboardingCompletedAt: null,
};

describe("resolveOnboardingStepDisplayState", () => {
  it("shows step 1 completed when revisiting profile after completion", () => {
    expect(resolveOnboardingStepDisplayState(1, step1Complete)).toBe("complete");
    expect(resolveOnboardingStepDisplayState(2, step1Complete)).toBe("current");
    expect(resolveOnboardingStepDisplayState(3, step1Complete)).toBe("locked");
  });

  it("shows step 2 in progress on documents placeholder", () => {
    const ctx = { ...step1Complete, activeStep: 2 };
    expect(resolveOnboardingStepDisplayState(1, ctx)).toBe("complete");
    expect(resolveOnboardingStepDisplayState(2, ctx)).toBe("current");
    expect(resolveOnboardingStepDisplayState(3, ctx)).toBe("locked");
  });

  it("shows earlier steps complete when viewing availability at step 3", () => {
    const ctx = {
      activeStep: 3,
      profileCompletedAt: "2026-01-01T00:00:00.000Z",
      onboardingStep: 3,
      onboardingCompletedAt: null,
    };
    expect(resolveOnboardingStepDisplayState(1, ctx)).toBe("complete");
    expect(resolveOnboardingStepDisplayState(2, ctx)).toBe("complete");
    expect(resolveOnboardingStepDisplayState(3, ctx)).toBe("current");
  });

  it("shows step 1 in progress before profile completion", () => {
    const ctx = {
      activeStep: 1,
      profileCompletedAt: null,
      onboardingStep: 1,
      onboardingCompletedAt: null,
    };
    expect(resolveOnboardingStepDisplayState(1, ctx)).toBe("current");
    expect(resolveOnboardingStepDisplayState(2, ctx)).toBe("locked");
  });
});

describe("onboardingStepStateLabel", () => {
  it('labels documents as "Next step" while editing completed step 1', () => {
    expect(onboardingStepStateLabel("current", 2, 1)).toBe("Next step");
    expect(onboardingStepStateLabel("complete", 1, 1)).toBe("Completed");
  });
});

describe("countCompletedOnboardingSteps", () => {
  it("counts one after step 1 completion", () => {
    expect(
      countCompletedOnboardingSteps({
        profileCompletedAt: "2026-01-01T00:00:00.000Z",
        onboardingStep: 2,
        onboardingCompletedAt: null,
      }),
    ).toBe(1);
  });
});
