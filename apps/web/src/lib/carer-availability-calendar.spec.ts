import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { weekStartsForMonth } from "@/lib/carer-availability-dates";
import { carerAvailabilityWeekQueryKey } from "@/lib/carer-availability-month-queries";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer availability calendar", () => {
  it("regular route renders month calendar", () => {
    const route = readSrc("routes/carer/availability.tsx");
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).toContain("CarerAvailabilityCalendar");
    expect(route).toContain("Back to portal");
    expect(route).not.toContain("CarerOnboardingHomeLink");
    expect(calendar).toContain("Calendar");
    expect(calendar).not.toContain("This week");
    expect(calendar).not.toContain("Next week");
  });

  it("uses month navigation with previous disabled on current month", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).toContain("isBeforeCurrentTorontoMonth");
    expect(calendar).toContain('aria-label="Previous month"');
    expect(calendar).toContain('aria-label="Next month"');
    expect(calendar).toContain("hideNavigation");
  });

  it("shows selected-day details with sorted windows and empty copy", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).toContain("No availability added for this day.");
    expect(calendar).toContain("sortSlotsByStartTime");
    expect(calendar).toContain("CarerAvailabilityAddButton");
    expect(calendar).toContain("CarerAvailabilityFormDialog");
    expect(calendar).toContain("CarerAvailabilityRemoveDialog");
  });

  it("blocks add and edit on past dates but keeps remove available", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).toContain("selectedIsPast");
    expect(calendar).toContain("allowEdit={!selectedIsPast}");
    expect(calendar).toContain("allowRemove");
  });

  it("loads month data via parallel week queries", () => {
    const hook = readSrc("lib/carer-availability-month-queries.ts");
    expect(hook).toContain("useQueries");
    expect(hook).toContain("weekStartsForMonth");
    expect(hook).toContain('["carer-availability", weekStart]');
  });

  it("requests correct week keys for August 2026", () => {
    const weeks = weekStartsForMonth({ year: 2026, month: 8 });
    expect(weeks).toHaveLength(6);
    expect(carerAvailabilityWeekQueryKey(weeks[0]!)).toEqual([
      "carer-availability",
      "2026-07-27",
    ]);
  });

  it("invalidates affected week after mutations", () => {
    const shared = readSrc("components/carer/CarerAvailabilityShared.tsx");
    expect(shared).toContain("invalidateWeek(form.weekStartDate)");
    expect(shared).toContain("invalidateWeek(removingSlot.weekStartDate)");
  });

  it("shows load errors instead of empty calendar", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).toContain("CarerAvailabilityLoadError");
    expect(calendar).toContain("isError");
  });
});

describe("carer availability calendar isolation", () => {
  it("does not use unavailable markers on regular calendar", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    const route = readSrc("routes/carer/availability.tsx");
    expect(calendar).not.toContain("markUnavailable");
    expect(calendar).not.toContain("clearUnavailable");
    expect(calendar).not.toContain("Not available");
    expect(route).not.toContain("markUnavailable");
  });

  it("does not call ops availability API or staffId", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).not.toMatch(/['"`]\/availability['"`]/);
    expect(calendar).not.toContain("staffId");
  });

  it("leaves onboarding wizard unchanged", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    const onboardingRoute = readSrc("routes/carer/onboarding/availability.tsx");
    expect(wizard).toContain("Week {activeWeek} of 2");
    expect(wizard).toContain("Complete availability step");
    expect(onboardingRoute).toContain("CarerAvailabilityOnboardingWizard");
    expect(onboardingRoute).not.toContain("CarerAvailabilityCalendar");
  });
});
