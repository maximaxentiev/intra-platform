import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding step navigation", () => {
  it("profile step advances to documents after completion", () => {
    const route = readSrc("routes/carer/onboarding/profile.tsx");
    const form = readSrc("components/carer/CarerPersonalInformationForm.tsx");
    expect(route).toContain('to: "/carer/onboarding/documents"');
    expect(form).toContain("Continue to step 2");
    expect(route).not.toContain("CarerOnboardingHomeLink");
  });

  it("documents step advances to availability after completion", () => {
    const route = readSrc("routes/carer/onboarding/documents.tsx");
    expect(route).toContain('to: "/carer/onboarding/availability"');
    expect(route).toContain("Continue to final step");
    expect(route).not.toContain("CarerOnboardingHomeLink");
  });

  it("availability completes onboarding to home", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("carerOnboardingApi.complete");
    expect(route).toContain('to: "/carer"');
    expect(route).not.toContain("CarerOnboardingHomeLink");
  });

  it("onboarding hub redirects instead of showing overview", () => {
    const hub = readSrc("routes/carer/onboarding/index.tsx");
    expect(hub).toContain("carerOnboardingResumePath");
    expect(hub).not.toContain("CarerOnboardingHub");
  });

  it("step access guards remain enforced", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("assertOnboardingStepAccess");
    expect(guards).toContain("assertOnboardingStarted");
  });
});
