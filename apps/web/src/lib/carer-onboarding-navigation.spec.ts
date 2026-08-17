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
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(form).toContain("Continue to documents");
  });

  it("documents step advances to availability after completion", () => {
    const route = readSrc("routes/carer/onboarding/documents.tsx");
    const form = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(route).toContain('to: "/carer/onboarding/availability"');
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(form).toContain("Continue to availability");
  });

  it("availability step still returns to hub after step completion", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("CARER_ONBOARDING_HUB_PATH");
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(route).not.toContain('to: "/carer"');
  });

  it("onboarding home link is shared across step pages", () => {
    const link = readSrc("components/carer/CarerOnboardingHomeLink.tsx");
    expect(link).toContain("Onboarding home");
    expect(link).toContain("CARER_ONBOARDING_HUB_PATH");
    expect(link).toContain("h-11");
  });

  it("final complete onboarding remains hub-only", () => {
    const hub = readSrc("routes/carer/onboarding/index.tsx");
    expect(hub).toContain("carerOnboardingApi.complete");
    expect(hub).toContain('to: "/carer"');
  });

  it("step access guards remain enforced", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("assertOnboardingStepAccess");
    expect(guards).toContain("maxAccessibleOnboardingStep");
  });
});
