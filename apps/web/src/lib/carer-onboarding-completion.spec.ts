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
  it("Week 2 final CTA says Complete onboarding and uses canCompleteOnboarding", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain("Complete onboarding");
    expect(wizard).toContain("Completing onboarding...");
    expect(wizard).toContain("!onboardingState.canCompleteOnboarding");
    expect(wizard).toContain("completeStep3");
    expect(wizard).not.toContain("Finishing");
  });

  it("successful completion redirects to carer with transient router state", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain('to: "/carer"');
    expect(route).toContain("CARER_ONBOARDING_JUST_COMPLETED_STATE");
    expect(route).toContain("onboardingJustCompleted");
    expect(route).not.toContain("localStorage");
    expect(route).not.toContain("sessionStorage");
  });

  it("carer home shows one-time onboarding complete banner from router state", () => {
    const home = readSrc("routes/carer/index.tsx");
    const banner = readSrc("components/carer/CarerOnboardingCompleteBanner.tsx");
    expect(home).toContain("CarerOnboardingCompleteBanner");
    expect(home).toContain("readOnboardingJustCompleted");
    expect(home).toContain("location.state");
    expect(banner).toContain(CARER_ONBOARDING_COMPLETE_BANNER.title);
    expect(banner).toContain(CARER_ONBOARDING_COMPLETE_BANNER.message);
    expect(banner).toContain('role="status"');
    expect(banner).toContain('aria-live="polite"');
  });

  it("does not show banner based on onboardingCompletedAt alone", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).not.toContain("onboardingCompletedAt");
  });

  it("approved message does not imply automatic shift matching", () => {
    const banner = readSrc("components/carer/CarerOnboardingCompleteBanner.tsx");
    const lib = readSrc("lib/carer-onboarding-completion.ts");
    expect(lib).not.toMatch(/automatically matched/i);
    expect(lib).not.toMatch(/only receive shifts during/i);
    expect(lib).not.toMatch(/guaranteed shifts/i);
    expect(lib).not.toMatch(/according to your availability/i);
    expect(banner).toContain("shift opportunities");
    expect(banner).toContain("Keep your availability up to date");
  });

  it("readOnboardingJustCompleted accepts only transient completion state", () => {
    expect(readOnboardingJustCompleted({ onboardingJustCompleted: true })).toBe(true);
    expect(readOnboardingJustCompleted({ onboardingJustCompleted: false })).toBe(false);
    expect(readOnboardingJustCompleted(null)).toBe(false);
    expect(readOnboardingJustCompleted(undefined)).toBe(false);
  });
});
