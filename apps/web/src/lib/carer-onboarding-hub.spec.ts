import { describe, expect, it } from "vitest";
import {
  buildHubStepCards,
  countCompletedHubSteps,
  hubStepAccessible,
  hubStepLockedReason,
} from "./carer-onboarding-hub";
import { carerSessionFixture } from "./carer-session-fixtures";

describe("carer onboarding hub helpers", () => {
  it("counts completed steps from authoritative session flags", () => {
    expect(
      countCompletedHubSteps(
        carerSessionFixture({
          profileComplete: true,
          documentsComplete: false,
          availabilityComplete: false,
        }),
      ),
    ).toBe(1);
    expect(
      countCompletedHubSteps(
        carerSessionFixture({
          profileComplete: true,
          documentsComplete: true,
          availabilityComplete: true,
        }),
      ),
    ).toBe(3);
  });

  it("does not infer documents completion from onboardingStep", () => {
    const session = carerSessionFixture({
      onboardingStep: 3,
      documentsCompletedAt: null,
      documentsComplete: false,
    });
    expect(buildHubStepCards(session)[1]?.complete).toBe(false);
  });

  it("uses availabilityComplete for step 3 status", () => {
    const incomplete = carerSessionFixture({
      onboardingStep: 3,
      availabilityCompletedAt: null,
      availabilityComplete: false,
    });
    expect(buildHubStepCards(incomplete)[2]?.complete).toBe(false);

    const complete = carerSessionFixture({
      availabilityCompletedAt: "2026-01-03T00:00:00.000Z",
      availabilityComplete: true,
    });
    expect(buildHubStepCards(complete)[2]?.complete).toBe(true);
  });

  it("locks later steps with clear guidance", () => {
    const session = carerSessionFixture({ profileComplete: false, documentsComplete: false });
    expect(hubStepLockedReason(2, session)).toBe("Complete Step 1 first");
    expect(hubStepLockedReason(3, session)).toBe("Complete Step 1 first");
    expect(
      hubStepLockedReason(
        3,
        carerSessionFixture({ profileComplete: true, documentsComplete: false }),
      ),
    ).toBe("Complete Step 2 first");
  });

  it("marks step accessible when prerequisites are met", () => {
    const session = carerSessionFixture({
      profileComplete: true,
      documentsComplete: true,
    });
    expect(hubStepAccessible(3, session)).toBe(true);
  });

  it("builds CTAs for complete and incomplete steps", () => {
    const session = carerSessionFixture({
      profileComplete: true,
      documentsComplete: false,
    });
    const cards = buildHubStepCards(session);
    expect(cards[0]?.ctaLabel).toBe("Edit personal information");
    expect(cards[1]?.ctaLabel).toBe("Complete documents");
    expect(cards[2]?.lockedReason).toBe("Complete Step 2 first");
  });
});
