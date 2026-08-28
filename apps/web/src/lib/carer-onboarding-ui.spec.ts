import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer onboarding routing", () => {
  it("gates portal home through onboarding resume routing", () => {
    const src = readSrc("routes/carer/index.tsx");
    expect(src).toContain("requireCarerSessionForPortal");
  });

  it("redirects incomplete portal routes to onboarding resume path", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    expect(guards).toContain("carerOnboardingResumePath");
  });

  it("uses intro screen before onboarding starts", () => {
    const intro = readSrc("routes/carer/onboarding/intro.tsx");
    expect(intro).toContain("carerOnboardingApi.start");
    expect(intro).toContain("/carer/onboarding/profile");
  });

  it("hub index redirects instead of rendering overview", () => {
    const hub = readSrc("routes/carer/onboarding/index.tsx");
    expect(hub).toContain("carerOnboardingResumePath");
    expect(hub).not.toContain("CarerOnboardingHub");
  });

  it("availability completion redirects home with success state", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("carerOnboardingApi.complete");
    expect(route).toContain("onboardingJustCompleted: true");
    expect(route).toContain('to: "/carer"');
  });
});
