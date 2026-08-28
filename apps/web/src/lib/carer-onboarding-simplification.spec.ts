import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CARER_ONBOARDING_INTRO_PATH,
  carerLandingPath,
  carerOnboardingResumePath,
  onboardingStarted,
} from "./carer-onboarding";
import { carerSessionFixture } from "./carer-session-fixtures";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding routing", () => {
  it("sends not-started incomplete users to intro", () => {
    expect(carerLandingPath(carerSessionFixture())).toBe(CARER_ONBOARDING_INTRO_PATH);
    expect(carerOnboardingResumePath(carerSessionFixture())).toBe(CARER_ONBOARDING_INTRO_PATH);
  });

  it("resumes started users at the furthest legitimate step", () => {
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({ onboardingStartedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toBe("/carer/onboarding/profile");
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({
          onboardingStartedAt: "2026-01-01T00:00:00.000Z",
          profileCompletedAt: "2026-01-01T00:00:00.000Z",
        }),
      ),
    ).toBe("/carer/onboarding/documents");
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({
          onboardingStartedAt: "2026-01-01T00:00:00.000Z",
          profileCompletedAt: "2026-01-01T00:00:00.000Z",
          documentsCompletedAt: "2026-01-02T00:00:00.000Z",
        }),
      ),
    ).toBe("/carer/onboarding/availability");
  });

  it("detects onboarding started from session timestamp", () => {
    expect(onboardingStarted(carerSessionFixture())).toBe(false);
    expect(
      onboardingStarted(carerSessionFixture({ onboardingStartedAt: "2026-01-01T00:00:00.000Z" })),
    ).toBe(true);
  });
});

describe("carer onboarding intro", () => {
  const intro = () => readSrc("routes/carer/onboarding/intro.tsx");
  const shell = () => readSrc("components/carer/CarerOnboardingStepShell.tsx");

  it("renders supplied intro copy and start button", () => {
    expect(shell()).toContain("You are about to begin the Intra platform onboarding");
    expect(shell()).toContain("platform.intra.ca/carer");
    expect(intro()).toContain("Start onboarding now");
    expect(intro()).toContain("carerOnboardingApi.start");
  });

  it("does not show portal navigation or back/skip actions", () => {
    expect(intro()).not.toContain("CarerBottomNav");
    expect(intro()).not.toContain("Skip");
    expect(intro()).not.toContain("Back to");
  });
});

describe("carer onboarding step 1", () => {
  const profile = () => readSrc("routes/carer/onboarding/profile.tsx");
  const shell = () => readSrc("components/carer/CarerOnboardingStepShell.tsx");
  const form = () => readSrc("components/carer/CarerPersonalInformationForm.tsx");

  it("uses exact title and instructions", () => {
    expect(shell()).toContain("Onboarding Step 1 - Confirm your personal information");
    expect(profile()).toContain("ONBOARDING_STEP_1_TITLE");
    expect(profile()).toContain("ONBOARDING_STEP_1_INSTRUCTIONS");
    expect(form()).toContain("Continue to step 2");
  });

  it("removes helper headings and keeps field labels in onboarding mode", () => {
    expect(form()).toContain('mode === "onboarding"');
    expect(form()).toContain('label="First name"');
    expect(form()).not.toContain("Your details");
    expect(form()).not.toContain("Legal name");
    expect(form()).not.toContain("Contact details");
    expect(form()).not.toContain("Where you live");
    expect(form()).not.toContain("Used for sign-in and shift notifications.");
  });

  it("uses Discard and Continue actions without back navigation", () => {
    expect(form()).toContain("Continue to step 2");
    expect(form()).toContain("Discard");
    expect(profile()).not.toContain("CarerOnboardingHomeLink");
    expect(profile()).not.toContain("CarerOnboardingShell");
  });
});

describe("carer onboarding step 2 documents", () => {
  const documents = () => readSrc("routes/carer/onboarding/documents.tsx");
  const shell = () => readSrc("components/carer/CarerOnboardingStepShell.tsx");
  const card = () => readSrc("components/carer/CarerOnboardingDocumentCard.tsx");
  const form = () => readSrc("components/carer/CarerDocumentsForm.tsx");

  it("uses exact title and instructions", () => {
    expect(shell()).toContain("Onboarding Step 2 - Submit documents");
    expect(documents()).toContain("ONBOARDING_STEP_2_TITLE");
    expect(documents()).toContain("Continue to final step");
  });

  it("uses simplified onboarding document cards", () => {
    expect(card()).toContain("Required");
    expect(card()).toContain("Optional");
    expect(card()).toContain("Processed date");
    expect(card()).toContain("Expiry date");
    expect(card()).not.toContain("None attached");
    expect(card()).not.toContain("Not Uploaded");
    expect(card()).not.toContain("formatVscRenewalDueLabel");
  });

  it("autosaves in onboarding without a general Save button", () => {
    expect(form()).toContain("saveCategoryImmediate");
    expect(form()).toContain("carer-onboarding-documents-form");
    expect(form()).toContain('mode !== "onboarding"');
  });
});

describe("carer onboarding step 3 availability", () => {
  const availability = () => readSrc("routes/carer/onboarding/availability.tsx");
  const shell = () => readSrc("components/carer/CarerOnboardingStepShell.tsx");
  const wizard = () => readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");

  it("uses exact title and Complete onboarding action", () => {
    expect(shell()).toContain("Final step - Submit availability");
    expect(availability()).toContain("ONBOARDING_STEP_3_TITLE");
    expect(availability()).toContain("Complete onboarding");
    expect(availability()).toContain("carerOnboardingApi.complete");
    expect(availability()).toContain('to: "/carer"');
  });

  it("keeps Week X of X and removes standalone date-range subtitle", () => {
    expect(wizard()).toContain("Week {activeWeek} of 2");
    expect(wizard()).not.toContain("formatWeekRangeLabel");
  });
});

describe("carer onboarding guards", () => {
  const guards = () => readSrc("lib/carer-route-guards.ts");

  it("redirects portal users into onboarding resume path", () => {
    expect(guards()).toContain("carerOnboardingResumePath");
    expect(guards()).toContain("assertOnboardingIntroAccess");
    expect(guards()).toContain("assertOnboardingStarted");
  });
});

describe("post-onboarding portal regression", () => {
  it("does not change account documents or profile routes", () => {
    const documents = readSrc("routes/carer/documents.tsx");
    const profile = readSrc("routes/carer/profile.tsx");
    expect(documents).toContain('mode="account"');
    expect(profile).toContain('mode="profile"');
    expect(documents).not.toContain("onboarding");
  });
});

describe("first login redirect", () => {
  it("uses carerLandingPath after password creation", () => {
    const invite = readSrc("routes/carer/invite.$token.tsx");
    expect(invite).toContain("carerLandingPath(session)");
  });
});
