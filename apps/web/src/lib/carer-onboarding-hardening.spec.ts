import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  carerLandingPath,
  carerOnboardingResumePath,
  CARER_ONBOARDING_INTRO_PATH,
  maxAccessibleOnboardingStep,
} from "./carer-onboarding";
import { carerSessionFixture } from "./carer-session-fixtures";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("onboarding intro start hardening", () => {
  it("disables start button while request is pending", () => {
    const intro = readSrc("routes/carer/onboarding/intro.tsx");
    expect(intro).toContain("disabled={loading}");
    expect(intro).toContain("await carerOnboardingApi.start()");
    expect(intro).toMatch(/navigate\([\s\S]*profile[\s\S]*\)[\s\S]*catch/);
  });

  it("does not navigate when start fails", () => {
    const intro = readSrc("routes/carer/onboarding/intro.tsx");
    expect(intro).toContain("toast.error");
    expect(intro).toMatch(/catch[\s\S]*finally/);
  });
});

describe("step 1 autosave race guards", () => {
  it("validates before autosave and ignores stale persist responses", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).toContain("validatePersonalProfileFields");
    expect(form).toContain("persistGeneration");
    expect(form).toContain("generation !== persistGeneration.current");
    expect(form).toContain("clearAutosaveTimer");
  });

  it("flushes autosave before continue", () => {
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(form).toContain("async function handleOnboardingContinue");
    expect(form).toMatch(/handleOnboardingContinue[\s\S]*clearAutosaveTimer/);
    expect(form).toMatch(/await persist\(false\)[\s\S]*await completeStep\(\)/);
  });
});

describe("step 2 date persistence hardening", () => {
  it("flushes pending date saves before continue", () => {
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(form).toContain("flushPendingOnboardingDateSaves");
    expect(form).toMatch(/handleNext[\s\S]*flushPendingOnboardingDateSaves[\s\S]*saveDirtyCategories/);
  });
});

describe("onboarding route-state matrix", () => {
  it("routes not-started users to intro", () => {
    expect(carerLandingPath(carerSessionFixture())).toBe(CARER_ONBOARDING_INTRO_PATH);
  });

  it("routes started step-1 incomplete users to profile", () => {
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({ onboardingStartedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toBe("/carer/onboarding/profile");
  });

  it("routes step-1 complete users to documents", () => {
    expect(
      carerOnboardingResumePath(
        carerSessionFixture({
          onboardingStartedAt: "2026-01-01T00:00:00.000Z",
          profileCompletedAt: "2026-01-01T00:00:00.000Z",
        }),
      ),
    ).toBe("/carer/onboarding/documents");
  });

  it("routes steps 1+2 complete users to availability", () => {
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

  it("routes completed users to home", () => {
    expect(
      carerLandingPath(
        carerSessionFixture({
          onboardingCompletedAt: "2026-01-03T00:00:00.000Z",
          onboardingComplete: true,
        }),
      ),
    ).toBe("/carer");
  });

  it("blocks manual URL skipping via maxAccessibleOnboardingStep", () => {
    expect(
      maxAccessibleOnboardingStep(
        carerSessionFixture({ onboardingStartedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toBe(1);
    expect(
      maxAccessibleOnboardingStep(
        carerSessionFixture({
          onboardingStartedAt: "2026-01-01T00:00:00.000Z",
          profileCompletedAt: "2026-01-01T00:00:00.000Z",
          onboardingStep: 3,
        }),
      ),
    ).toBe(3);
    expect(maxAccessibleOnboardingStep(carerSessionFixture())).toBe(0);
  });
});

describe("completed-carer portal access", () => {
  it("portal routes require onboarding completion", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("onboardingComplete(session)");
    expect(guards).toContain("carerOnboardingResumePath");
    for (const rel of [
      "routes/carer/index.tsx",
      "routes/carer/shifts.tsx",
      "routes/carer/availability.tsx",
      "routes/carer/documents.tsx",
      "routes/carer/profile.tsx",
    ]) {
      expect(readSrc(rel)).toContain("requireCarerSessionForPortal");
    }
  });
});
