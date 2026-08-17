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

describe("carer availability calendar regression", () => {
  it("regular route renders availability manager", () => {
    const route = readSrc("routes/carer/availability.tsx");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).toContain("CarerAvailabilityManager");
    expect(route).toContain("Back to portal");
    expect(route).not.toContain("CarerOnboardingHomeLink");
  });

  it("month view still uses month navigation and parallel week queries", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    const hook = readSrc("lib/carer-availability-month-queries.ts");
    expect(calendar).toContain('aria-label="Previous month"');
    expect(calendar).toContain('aria-label="Next month"');
    expect(calendar).toContain("hideNavigation");
    expect(hook).toContain("useQueries");
    expect(hook).toContain("weekStartsForMonth");
  });

  it("requests correct week keys for August 2026", () => {
    const weeks = weekStartsForMonth({ year: 2026, month: 8 });
    expect(weeks).toHaveLength(6);
    expect(carerAvailabilityWeekQueryKey(weeks[0]!)).toEqual([
      "carer-availability",
      "2026-07-27",
    ]);
  });

  it("blocks add and edit on past dates but keeps remove available", () => {
    const panel = readSrc("components/carer/CarerAvailabilitySelectedDayPanel.tsx");
    expect(panel).toContain("allowEdit={!selectedIsPast}");
    expect(panel).toContain("allowRemove");
  });

  it("does not use unavailable markers on regular calendar", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).not.toContain("markUnavailable");
    expect(calendar).not.toContain("Not available");
  });
});
