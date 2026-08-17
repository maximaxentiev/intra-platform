import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  currentMondayWeekStart,
  isBeforeCurrentTorontoWeek,
  weekDayDates,
} from "@/lib/carer-availability-dates";
import {
  carerAvailabilityUpcomingQueryKey,
  upcomingAvailabilityRangeLabel,
} from "@/lib/carer-availability-upcoming";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("carer availability week view", () => {
  it("defaults regular route to week-first manager", () => {
    const route = readSrc("routes/carer/availability.tsx");
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    expect(route).toContain("CarerAvailabilityManager");
    expect(manager).toContain('useState<AvailabilityViewMode>("week")');
    expect(manager).toContain("CarerAvailabilityWeekView");
    expect(manager).toContain("CarerAvailabilityMonthView");
  });

  it("provides week and month toggle without persisting preference", () => {
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    expect(manager).toContain('role="tablist"');
    expect(manager).toContain('"week"');
    expect(manager).toContain('"month"');
    expect(manager).not.toContain("localStorage");
  });

  it("uses current Toronto week by default with previous disabled", () => {
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    const weekView = readSrc("components/carer/CarerAvailabilityWeekView.tsx");
    expect(manager).toContain("currentMondayWeekStart");
    expect(weekView).toContain("isBeforeCurrentTorontoWeek");
    expect(weekView).toContain('aria-label="Previous week"');
    expect(weekView).toContain('aria-label="Next week"');
    expect(isBeforeCurrentTorontoWeek("2026-08-03", "2026-08-13")).toBe(true);
    expect(isBeforeCurrentTorontoWeek("2026-08-10", "2026-08-13")).toBe(false);
  });

  it("loads one week query per week view", () => {
    const weekQueries = readSrc("lib/carer-availability-week-queries.ts");
    const weekView = readSrc("components/carer/CarerAvailabilityWeekView.tsx");
    expect(weekQueries).toContain("carerAvailabilityWeekQueryKey");
    expect(weekView).toContain("useCarerAvailabilityWeek");
    expect(weekView).not.toContain("useCarerAvailabilityMonthWeeks");
  });

  it("shows seven-day strip with availability indicators and selected-day panel", () => {
    const weekView = readSrc("components/carer/CarerAvailabilityWeekView.tsx");
    expect(weekView).toContain("weekDayDates");
    expect(weekView).toContain("grid-cols-7");
    expect(weekView).toContain("windows");
    expect(weekView).toContain("CarerAvailabilitySelectedDayPanel");
    expect(weekDayDates(currentMondayWeekStart("2026-08-13"))).toHaveLength(7);
  });

  it("retains selected date when switching views", () => {
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    expect(manager).toContain("mondayOfDateString(selectedDate)");
    expect(manager).toContain("setDisplayMonth");
  });
});

describe("carer availability month view preservation", () => {
  it("keeps monthly calendar as optional month view", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    expect(calendar).toContain("CarerAvailabilityMonthView");
    expect(calendar).toContain("Calendar");
    expect(calendar).toContain("isBeforeCurrentTorontoMonth");
    expect(calendar).toContain("useCarerAvailabilityMonthWeeks");
  });

  it("reuses shared selected-day panel for month view", () => {
    const calendar = readSrc("components/carer/CarerAvailabilityCalendar.tsx");
    const panel = readSrc("components/carer/CarerAvailabilitySelectedDayPanel.tsx");
    expect(calendar).toContain("CarerAvailabilitySelectedDayPanel");
    expect(panel).toContain("CarerAvailabilityWindowList");
    expect(panel).toContain("allowEdit={!selectedIsPast}");
  });
});

describe("carer availability upcoming list", () => {
  it("uses server paginated upcoming endpoint", () => {
    const api = readSrc("lib/carer-availability.ts");
    const upcoming = readSrc("lib/carer-availability-upcoming.ts");
    expect(api).toContain("/staff-portal/availability/upcoming");
    expect(upcoming).toContain('["carer-availability-upcoming", page, pageSize]');
  });

  it("renders upcoming section with 10/25/50 selector and pagination", () => {
    const list = readSrc("components/carer/CarerAvailabilityUpcomingList.tsx");
    expect(list).toContain('id="upcoming-availability"');
    expect(list).toContain("Upcoming availability");
    expect(list).toContain("No upcoming availability added.");
    expect(list).toContain("10");
    expect(list).toContain("25");
    expect(list).toContain("50");
    expect(list).toContain("PaginationPrevious");
    expect(list).toContain("setPage(1)");
    expect(upcomingAvailabilityRangeLabel({
      items: [],
      page: 1,
      pageSize: 10,
      totalDates: 37,
      totalPages: 4,
    })).toBe("Showing 1–10 of 37 dates");
  });

  it("invalidates upcoming queries after mutations", () => {
    const shared = readSrc("components/carer/CarerAvailabilityShared.tsx");
    expect(shared).toContain('["carer-availability-upcoming"]');
  });
});

describe("carer availability dashboard summary", () => {
  it("loads page 1 pageSize 10 on portal home with Availability title", () => {
    const dashboard = readSrc("components/carer/CarerAvailabilityDashboardSummary.tsx");
    const home = readSrc("routes/carer/index.tsx");
    expect(dashboard).toContain("useCarerUpcomingAvailability(1, 10)");
    expect(home).toContain("CarerAvailabilityDashboardSummary");
    expect(home).toContain("Availability");
  });

  it("shows Add availability below title when there is no upcoming availability", () => {
    const dashboard = readSrc("components/carer/CarerAvailabilityDashboardSummary.tsx");
    const body = dashboard.slice(dashboard.indexOf('<div className="space-y-3 text-sm">'));
    expect(dashboard).toContain('to="/carer/availability"');
    expect(dashboard).toContain("Add availability");
    expect(dashboard).toContain("No upcoming availability added.");
    expect(dashboard).toContain("hasUpcoming");
    expect(body.indexOf("Add availability")).toBeLessThan(body.indexOf("No upcoming availability added."));
    expect(body).not.toMatch(/No upcoming availability added\.[\s\S]*Add availability/);
  });

  it("shows Edit availability below title when upcoming dates exist", () => {
    const dashboard = readSrc("components/carer/CarerAvailabilityDashboardSummary.tsx");
    const body = dashboard.slice(dashboard.indexOf('<div className="space-y-3 text-sm">'));
    expect(dashboard).toContain("Edit availability");
    expect(dashboard).toContain('hasUpcoming ? "Edit availability" : "Add availability"');
    expect(body.indexOf("Edit availability")).toBeLessThan(
      body.indexOf("formatDashboardAvailabilityDateLabel"),
    );
  });

  it("renders upcoming dates below the action and View more below the dates", () => {
    const dashboard = readSrc("components/carer/CarerAvailabilityDashboardSummary.tsx");
    const body = dashboard.slice(dashboard.indexOf('<div className="space-y-3 text-sm">'));
    expect(dashboard).toContain("formatDashboardAvailabilityDateLabel");
    expect(dashboard).toContain("View more");
    expect(dashboard).toContain('hash="upcoming-availability"');
    expect(body.indexOf("formatDashboardAvailabilityDateLabel")).toBeLessThan(body.indexOf("View more"));
    expect(dashboard).not.toContain("Remove");
    expect(dashboard).not.toContain("Trash2");
  });
});

describe("carer availability onboarding isolation", () => {
  it("leaves onboarding wizard unchanged", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    const onboardingRoute = readSrc("routes/carer/onboarding/availability.tsx");
    expect(wizard).toContain("Week {activeWeek} of 2");
    expect(onboardingRoute).toContain("CarerAvailabilityOnboardingWizard");
    expect(onboardingRoute).not.toContain("CarerAvailabilityManager");
    expect(wizard).not.toContain("Upcoming availability");
    expect(wizard).not.toContain("CarerAvailabilityWeekView");
  });
});
