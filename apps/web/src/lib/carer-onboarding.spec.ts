import { describe, expect, it } from "vitest";
import {
  carerLandingPath,
  carerOnboardingResumePath,
  CARER_ONBOARDING_INTRO_PATH,
} from "./carer-onboarding";
import { carerSessionFixture } from "./carer-session-fixtures";

describe("carerOnboardingResumePath", () => {
  it("starts at intro when onboarding has not started", () => {
    expect(carerOnboardingResumePath(carerSessionFixture())).toBe(CARER_ONBOARDING_INTRO_PATH);
  });

  it("starts at profile when started but step 1 incomplete", () => {
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({ onboardingStartedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toBe("/carer/onboarding/profile");
  });
});

describe("carerLandingPath", () => {
  it("sends incomplete not-started users to intro", () => {
    expect(carerLandingPath(carerSessionFixture())).toBe(CARER_ONBOARDING_INTRO_PATH);
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
