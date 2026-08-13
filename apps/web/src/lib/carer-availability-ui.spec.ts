import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer availability UI contracts", () => {
  it("onboarding step 3 uses the guided availability wizard", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(route).toContain("CarerAvailabilityOnboardingWizard");
    expect(route).toContain("ensureOnboardingState");
    expect(route).toContain("CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY");
    expect(route).not.toContain("CarerAvailabilityEditor");
    expect(route).not.toContain("Previous week");
    expect(route).toContain("Back to Documents");
    expect(wizard).toContain("Week {activeWeek} of 2");
    expect(wizard).toContain("Next week");
    expect(wizard).toContain("Previous week");
    expect(wizard).toContain("Complete onboarding");
    expect(wizard).toContain("Finishing");
    expect(wizard).toContain("week1Complete");
    expect(wizard).toContain("canCompleteOnboarding");
    expect(wizard).not.toContain("This week");
  });

  it("onboarding wizard renders server day statuses", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain("exempt_past");
    expect(wizard).toContain("No response required");
    expect(wizard).toContain("Not available");
    expect(wizard).toContain("Needs a response");
    expect(wizard).toContain("markUnavailable");
    expect(wizard).toContain("Mark this day as not available?");
    expect(wizard).toContain("Your saved availability for this day will be removed.");
  });

  it("account availability route is constrained to this week and next week", () => {
    const route = readSrc("routes/carer/availability.tsx");
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    expect(route).toContain("/carer/availability");
    expect(route).toContain("CarerAvailabilityEditor");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).not.toContain("Finish onboarding");
    expect(route).not.toContain("Complete onboarding");
    expect(editor).toContain("This week");
    expect(editor).toContain("Next week");
    expect(editor).not.toContain("Previous week");
    expect(editor).not.toContain("markUnavailable");
    expect(editor).not.toContain("Not available");
  });

  it("carer home links to profile and availability management", () => {
    const home = readSrc("routes/carer/index.tsx");
    expect(home).toContain('to="/carer/availability"');
    expect(home).toContain('to="/carer/profile"');
    expect(home).toContain("Manage availability");
    expect(home).toContain("Edit personal information");
    expect(home).toContain("Manage documents");
  });

  it("profile route reuses CarerPersonalInformationForm in profile mode", () => {
    const profile = readSrc("routes/carer/profile.tsx");
    expect(profile).toContain("/carer/profile");
    expect(profile).toContain("requireCarerSessionForPortal");
    expect(profile).toContain('mode="profile"');
    expect(profile).toContain("CarerPersonalInformationForm");
    expect(profile).not.toContain("completeStep1");
    expect(profile).not.toContain("staffId");
  });

  it("editor hides add and edit on past days", () => {
    const editor = readSrc("components/carer/CarerAvailabilityEditor.tsx");
    const shared = readSrc("components/carer/CarerAvailabilityShared.tsx");
    expect(shared).toContain("Add availability");
    expect(editor).toContain("!past");
    expect(shared).toContain("Remove");
  });

  it("shared helpers validate start before end client-side", () => {
    const shared = readSrc("components/carer/CarerAvailabilityShared.tsx");
    const lib = readSrc("lib/carer-availability.ts");
    expect(shared).toContain("validateClientTimeRange");
    expect(lib).toContain("End time must be after start time");
  });

  it("components map overlap API errors for users", () => {
    const shared = readSrc("components/carer/CarerAvailabilityShared.tsx");
    expect(shared).toContain("mapAvailabilityApiError");
  });

  it("carer availability client never references ops availability API", () => {
    const client = readSrc("lib/carer-availability.ts");
    expect(client).toContain("/staff-portal/availability");
    expect(client).not.toMatch(/['"`]\/availability['"`]/);
    expect(client).not.toContain("staffId");
  });
});
