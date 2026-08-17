import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer availability UI contracts", () => {
  it("onboarding step 3 uses simplified guided wizard", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(route).toContain("CarerAvailabilityOnboardingWizard");
    expect(route).toContain("CarerOnboardingHomeLink");
    expect(wizard).toContain("Week {activeWeek} of 2");
    expect(wizard).toContain("Next week");
    expect(wizard).toContain("Previous week");
    expect(wizard).toContain("Complete availability step");
    expect(wizard).toContain("Your changes are saved automatically");
    expect(wizard).not.toContain("week1Complete");
    expect(wizard).not.toContain("canCompleteOnboarding");
    expect(wizard).not.toContain("Needs a response");
    expect(wizard).not.toContain("Not available");
  });

  it("account availability route remains constrained to this week and next week", () => {
    const route = readSrc("routes/carer/availability.tsx");
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(editor).toContain("This week");
    expect(editor).toContain("Next week");
  });
});
