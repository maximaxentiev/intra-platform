import { describe, expect, it, vi } from "vitest";
import {
  addDaysToDateString,
  calendarDateFromWeekDay,
  currentMondayWeekStart,
  formatAvailabilityTimeDisplay,
  formatAvailabilityWindowDisplay,
  formatWeekRangeLabel,
  isPastCalendarDate,
  isTodayCalendarDate,
  mondayOfDateString,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";

describe("torontoTodayDateString", () => {
  it("uses America/Toronto calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T16:00:00.000Z"));
    expect(torontoTodayDateString()).toBe("2026-08-13");
    vi.useRealTimers();
  });
});

describe("calendarDateFromWeekDay", () => {
  it("maps Monday week start and day indices", () => {
    expect(calendarDateFromWeekDay("2026-08-10", 0)).toBe("2026-08-10");
    expect(calendarDateFromWeekDay("2026-08-10", 3)).toBe("2026-08-13");
  });
});

describe("week helpers", () => {
  it("finds Monday for a calendar date", () => {
    expect(mondayOfDateString("2026-08-13")).toBe("2026-08-10");
  });

  it("defaults current week to Monday of Toronto today", () => {
    expect(currentMondayWeekStart("2026-08-13")).toBe("2026-08-10");
  });

  it("formats week range labels", () => {
    expect(formatWeekRangeLabel("2026-08-10")).toContain("Aug");
  });

  it("adds days without timezone rollover", () => {
    expect(addDaysToDateString("2026-08-10", 6)).toBe("2026-08-16");
  });
});

describe("day classification", () => {
  it("detects past and today", () => {
    expect(isPastCalendarDate("2026-08-12", "2026-08-13")).toBe(true);
    expect(isTodayCalendarDate("2026-08-13", "2026-08-13")).toBe(true);
    expect(isPastCalendarDate("2026-08-13", "2026-08-13")).toBe(false);
  });
});

describe("time display", () => {
  it("formats HH:mm for display", () => {
    expect(formatAvailabilityTimeDisplay("09:00")).toBe("9:00 AM");
    expect(formatAvailabilityTimeDisplay("17:30")).toBe("5:30 PM");
  });

  it("formats windows", () => {
    expect(formatAvailabilityWindowDisplay("09:00", "17:00")).toBe("9:00 AM – 5:00 PM");
  });
});
