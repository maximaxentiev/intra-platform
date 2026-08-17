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
  it("availability wizard completes availability step only", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain("Complete availability step");
    expect(wizard).toContain("Completing step...");
    expect(wizard).toContain("completeOnboardingStep");
    expect(wizard).not.toContain("Complete onboarding");
    expect(wizard).not.toContain("canCompleteOnboarding");
    expect(wizard).not.toContain("completeStep3");
    expect(wizard).not.toContain("Not available");
    expect(wizard).not.toContain("markUnavailable");
  });

  it("hub final completion redirects to carer with transient router state", () => {
    const hub = readSrc("routes/carer/onboarding/index.tsx");
    const completion = readSrc("lib/carer-onboarding-completion.ts");
    expect(hub).toContain('to: "/carer"');
    expect(hub).toContain("onboardingJustCompleted: true");
    expect(completion).toContain("onboardingJustCompleted");
    expect(hub).not.toContain("localStorage");
    expect(hub).not.toContain("sessionStorage");
  });

  it("availability step does not trigger success banner", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).not.toContain("CarerOnboardingCompleteBanner");
    expect(route).not.toContain("CARER_ONBOARDING_JUST_COMPLETED_STATE");
  });

  it("carer home shows one-time onboarding complete banner from router state", () => {
    const home = readSrc("routes/carer/index.tsx");
    const banner = readSrc("components/carer/CarerOnboardingCompleteBanner.tsx");
    expect(home).toContain("CarerOnboardingCompleteBanner");
    expect(home).toContain("readOnboardingJustCompleted");
    expect(banner).toContain("CARER_ONBOARDING_COMPLETE_BANNER.title");
    expect(banner).toContain("CARER_ONBOARDING_COMPLETE_BANNER.message");
    expect(CARER_ONBOARDING_COMPLETE_BANNER.title).toBe("Onboarding complete");
  });

  it("readOnboardingJustCompleted accepts only transient completion state", () => {
    expect(readOnboardingJustCompleted({ onboardingJustCompleted: true })).toBe(true);
    expect(readOnboardingJustCompleted(null)).toBe(false);
  });
});
