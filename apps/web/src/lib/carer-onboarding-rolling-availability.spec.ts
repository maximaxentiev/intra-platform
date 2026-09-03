import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  buildRollingOnboardingDays,
  calendarDateToWeekDay,
  getOnboardingAvailabilityWindow,
} from "@/lib/carer-availability-dates";
import {
  countOnboardingWeekProgress,
  type CarerGuidedAvailabilityOnboardingState,
  type CarerOnboardingAvailabilityDay,
} from "@/lib/carer-availability";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

/** Mirrors CarerAvailabilityOnboardingWizard week-day filtering. */
function visibleOnboardingWeekDays(
  days: CarerOnboardingAvailabilityDay[],
  activeWeek: 1 | 2,
): CarerOnboardingAvailabilityDay[] {
  return days.filter((d) => d.weekIndex === activeWeek && d.status !== "exempt_past");
}

function buildMockRollingOnboardingState(
  today: string,
  savedWindows: Array<{ calendarDate: string; startTime?: string }> = [],
): CarerGuidedAvailabilityOnboardingState {
  const rollingDays = buildRollingOnboardingDays(today);
  const savedByDate = new Map(
    savedWindows.map((w) => [
      w.calendarDate,
      [
        {
          id: `slot-${w.calendarDate}`,
          weekStartDate: calendarDateToWeekDay(w.calendarDate).weekStartDate,
          dayOfWeek: calendarDateToWeekDay(w.calendarDate).dayOfWeek,
          startTime: w.startTime ?? "09:00",
          endTime: "12:00",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    ]),
  );

  const days: CarerOnboardingAvailabilityDay[] = rollingDays.map((day) => {
    const windows = savedByDate.get(day.calendarDate) ?? [];
    return {
      calendarDate: day.calendarDate,
      weekIndex: day.weekIndex,
      dayOfWeek: day.dayOfWeek,
      status: windows.length > 0 ? "available" : "incomplete",
      windows,
    };
  });

  const week1Days = days.filter((d) => d.weekIndex === 1);
  const week2Days = days.filter((d) => d.weekIndex === 2);
  const week1Complete = week1Days.every((d) => d.status !== "incomplete");
  const week2Complete = week2Days.every((d) => d.status !== "incomplete");

  return {
    anchorEstablished: true,
    week1Start: today,
    week2Start: rollingDays[7]?.calendarDate ?? null,
    days,
    week1Complete,
    week2Complete,
    canCompleteOnboarding: week1Complete && week2Complete,
  };
}

describe("getOnboardingAvailabilityWindow", () => {
  it("returns today through today + 13 days", () => {
    expect(getOnboardingAvailabilityWindow("2026-06-10")).toEqual({
      start: "2026-06-10",
      end: "2026-06-23",
    });
  });

  it("crosses month boundary", () => {
    expect(getOnboardingAvailabilityWindow("2026-01-25")).toEqual({
      start: "2026-01-25",
      end: "2026-02-07",
    });
  });

  it("crosses year boundary", () => {
    expect(getOnboardingAvailabilityWindow("2025-12-25")).toEqual({
      start: "2025-12-25",
      end: "2026-01-07",
    });
  });

  it("handles leap-year February boundary", () => {
    expect(getOnboardingAvailabilityWindow("2024-02-20")).toEqual({
      start: "2024-02-20",
      end: "2024-03-04",
    });
  });
});

describe("buildRollingOnboardingDays", () => {
  it("returns 14 dates starting today with week grouping", () => {
    const days = buildRollingOnboardingDays("2026-06-10");
    expect(days).toHaveLength(14);
    expect(days[0]?.calendarDate).toBe("2026-06-10");
    expect(days[13]?.calendarDate).toBe("2026-06-23");
    expect(days.filter((d) => d.weekIndex === 1)).toHaveLength(7);
    expect(days.filter((d) => d.weekIndex === 2)).toHaveLength(7);
  });
});

describe("returning carer onboarding Step 3", () => {
  it("shows rolling window from today, not original onboarding anchor period", () => {
    const today = "2026-06-10";
    const onboardingAnchorMonday = "2026-06-01";
    expect(onboardingAnchorMonday).not.toBe(today);

    const state = buildMockRollingOnboardingState(today, [
      { calendarDate: "2026-06-12" },
      { calendarDate: "2026-06-14" },
    ]);

    expect(state.week1Start).toBe(today);
    expect(state.days).toHaveLength(14);
    expect(state.days[0]?.calendarDate).toBe(today);
    expect(state.days.some((d) => d.calendarDate < today)).toBe(false);
    expect(state.days.some((d) => d.calendarDate === "2026-06-01")).toBe(false);
    expect(state.days.find((d) => d.calendarDate === "2026-06-12")?.windows).toHaveLength(1);
    expect(state.days.find((d) => d.calendarDate === "2026-06-14")?.windows).toHaveLength(1);
    expect(state.days.find((d) => d.calendarDate === "2026-06-11")?.status).toBe("incomplete");
  });

  it("excludes past dates from visible week tabs", () => {
    const days: CarerOnboardingAvailabilityDay[] = [
      {
        calendarDate: "2026-06-09",
        weekIndex: 1,
        dayOfWeek: 0,
        status: "exempt_past",
        windows: [],
      },
      ...buildRollingOnboardingDays("2026-06-10").map((day) => ({
        calendarDate: day.calendarDate,
        weekIndex: day.weekIndex,
        dayOfWeek: day.dayOfWeek,
        status: "incomplete" as const,
        windows: [],
      })),
    ];

    const week1Visible = visibleOnboardingWeekDays(days, 1);
    expect(week1Visible.some((d) => d.calendarDate === "2026-06-09")).toBe(false);
    expect(week1Visible).toHaveLength(7);
    expect(week1Visible[0]?.calendarDate).toBe("2026-06-10");
  });
});

describe("onboarding completion validation", () => {
  it("evaluates only the current rolling window, not stale past dates", () => {
    const today = "2026-06-10";
    const state = buildMockRollingOnboardingState(today);

    expect(state.days.every((d) => d.status !== "exempt_past")).toBe(true);
    expect(state.days.some((d) => d.calendarDate < today)).toBe(false);
    expect(countOnboardingWeekProgress(state.days, 1).required).toBe(7);
    expect(countOnboardingWeekProgress(state.days, 2).required).toBe(7);
    expect(state.canCompleteOnboarding).toBe(false);
  });
});

describe("onboarding Step 3 UI contracts", () => {
  it("wizard filters exempt_past days from week display", () => {
    const wizard = readSrc("components/carer/CarerAvailabilityOnboardingWizard.tsx");
    expect(wizard).toContain('d.status !== "exempt_past"');
  });

  it("step shell copy describes next two weeks", () => {
    const shell = readSrc("components/carer/CarerOnboardingStepShell.tsx");
    expect(shell).toContain("Add your availability for the next two weeks.");
    expect(shell).not.toContain("onboarding period starting");
  });

  it("availability route refreshes onboarding state on load", () => {
    const route = readSrc("routes/carer/onboarding/availability.tsx");
    expect(route).toContain("ensureOnboardingState");
    expect(route).toContain("getOnboardingState");
    expect(route).toContain("CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY");
  });
});

describe("post-onboarding availability regression", () => {
  it("regular availability manager still uses Monday week navigation", () => {
    const manager = readSrc("components/carer/CarerAvailabilityManager.tsx");
    expect(manager).toContain("currentMondayWeekStart");
    expect(manager).not.toContain("buildRollingOnboardingDays");
    expect(manager).not.toContain("getOnboardingAvailabilityWindow");
  });

  it("rolling helpers are not used outside onboarding", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T16:00:00.000Z"));
    const datesSrc = readSrc("lib/carer-availability-dates.ts");
    expect(datesSrc).toContain("getOnboardingAvailabilityWindow");
    const weekView = readSrc("components/carer/CarerAvailabilityWeekView.tsx");
    expect(weekView).not.toContain("buildRollingOnboardingDays");
    vi.useRealTimers();
  });
});
