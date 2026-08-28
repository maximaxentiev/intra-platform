import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CARER_ONBOARDING_COMPLETE_BANNER,
  readOnboardingJustCompleted,
} from "@/lib/carer-onboarding-completion";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding completion UX", () => {
  it("availability route completes onboarding and redirects home", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("carerOnboardingApi.complete");
    expect(route).toContain('to: "/carer"');
    expect(route).toContain("onboardingJustCompleted: true");
  });

  it("availability wizard keeps week navigation without final completion button", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain("Next week");
    expect(wizard).not.toContain("Complete onboarding");
    expect(wizard).not.toContain("completeOnboardingStep");
  });

  it("carer home shows one-time onboarding complete banner from router state", () => {
    const home = readSrc("routes/carer/index.tsx");
    const banner = readSrc("components/carer/CarerOnboardingCompleteBanner.tsx");
    expect(home).toContain("CarerOnboardingCompleteBanner");
    expect(home).toContain("readOnboardingJustCompleted");
    expect(banner).toContain("CARER_ONBOARDING_COMPLETE_BANNER.title");
    expect(CARER_ONBOARDING_COMPLETE_BANNER.title).toBe("Onboarding complete");
  });

  it("readOnboardingJustCompleted accepts only transient completion state", () => {
    expect(readOnboardingJustCompleted({ onboardingJustCompleted: true })).toBe(true);
    expect(readOnboardingJustCompleted(null)).toBe(false);
  });
});
