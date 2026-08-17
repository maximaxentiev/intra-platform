import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding routing", () => {
  it("gates portal home through onboarding hub", () => {
    const src = readSrc("routes/carer/index.tsx");
    expect(src).toContain("CARER_ONBOARDING_HUB_PATH");
    expect(src).not.toContain("carerOnboardingResumePath");
  });

  it("redirects incomplete portal routes to hub", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("CARER_ONBOARDING_HUB_PATH");
    expect(guards).not.toContain("carerOnboardingResumePath");
  });

  it("implements a real onboarding hub page", () => {
    const hub = readSrc("routes/carer/onboarding/index.tsx");
    const component = readSrc("components/carer/CarerOnboardingHub.tsx");
    expect(hub).toContain("CarerOnboardingHub");
    expect(hub).toContain("carerOnboardingApi.complete");
    expect(component).toContain("Onboarding not complete");
    expect(component).toContain("Complete onboarding");
    expect(component).toContain("canCompleteOnboarding");
  });

  it("documents step advances to availability after completion", () => {
    const route = readSrc("routes/carer/onboarding/documents.tsx");
    expect(route).toContain('to: "/carer/onboarding/availability"');
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(route).not.toContain("stepPathForNumber(3)");
  });

  it("profile step advances to documents after completion", () => {
    const route = readSrc("routes/carer/onboarding/profile.tsx");
    expect(route).toContain('to: "/carer/onboarding/documents"');
    expect(route).toContain("CarerOnboardingHomeLink");
  });

  it("availability step returns to hub without success banner", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("CARER_ONBOARDING_HUB_PATH");
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(route).not.toContain("CARER_ONBOARDING_JUST_COMPLETED_STATE");
    expect(route).not.toContain('to: "/carer"');
  });
});
