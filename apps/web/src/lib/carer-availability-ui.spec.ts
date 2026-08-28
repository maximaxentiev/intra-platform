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
    expect(route).toContain("CarerOnboardingStepShell");
    expect(route).toContain("Complete onboarding");
    expect(wizard).toContain("Week {activeWeek} of 2");
    expect(wizard).toContain("Next week");
    expect(wizard).toContain("Previous week");
    expect(wizard).not.toContain("CarerOnboardingHomeLink");
    expect(wizard).not.toContain("Complete availability step");
    expect(wizard).not.toContain("week1Complete");
    expect(wizard).not.toContain("canCompleteOnboarding");
    expect(wizard).not.toContain("Needs a response");
    expect(wizard).not.toContain("Not available");
  });

  it("regular availability route uses a simplified week-only manager", () => {
    const route = readSrc("routes/carer/availability.tsx");
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).toContain("CarerAvailabilityManager");
    expect(manager).toContain("CarerAvailabilityWeekView");
    expect(manager).not.toContain("CarerAvailabilityMonthView");
    expect(route).not.toContain("Tell Intra when you can work.");
    expect(route).toContain("CarerBackButton");
  });
});
