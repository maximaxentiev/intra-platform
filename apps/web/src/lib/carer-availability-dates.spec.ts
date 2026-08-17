import { describe, expect, it, vi } from "vitest";
import {
  addDaysToDateString,
  addMonthsToMonthYear,
  calendarDateFromWeekDay,
  calendarDateToWeekDay,
  currentMondayWeekStart,
  currentTorontoMonthYear,
  defaultSelectedDateForMonth,
  formatAvailabilityTimeDisplay,
  formatAvailabilityWindowDisplay,
  formatFullCalendarDateWithYearLabel,
  formatWeekRangeLabel,
  isBeforeCurrentTorontoMonth,
  isBeforeCurrentTorontoWeek,
  isPastCalendarDate,
  isTodayCalendarDate,
  mondayOfDateString,
  slotToCalendarDate,
  torontoTodayDateString,
  weekStartsForMonth,
  weekDayDates,
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

  it("lists all days in a Monday week", () => {
    expect(weekDayDates("2026-08-10")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });

  it("detects weeks before the current Toronto week", () => {
    expect(isBeforeCurrentTorontoWeek("2026-08-03", "2026-08-13")).toBe(true);
    expect(isBeforeCurrentTorontoWeek("2026-08-10", "2026-08-13")).toBe(false);
  });
});

describe("day classification", () => {
  it("formats full calendar dates with weekday, month, day, and year", () => {
    const label = formatFullCalendarDateWithYearLabel("2026-08-25");
    expect(label).toContain("Tuesday");
    expect(label).toContain("August");
    expect(label).toContain("25");
    expect(label).toContain("2026");
  });

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

describe("month calendar helpers", () => {
  it("uses current Toronto month", () => {
    expect(currentTorontoMonthYear("2026-08-17")).toEqual({ year: 2026, month: 8 });
  });

  it("calculates Monday weeks for August 2026 including six weeks", () => {
    expect(weekStartsForMonth({ year: 2026, month: 8 })).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("handles month beginning on Sunday", () => {
    expect(weekStartsForMonth({ year: 2026, month: 3 })[0]).toBe("2026-02-23");
  });

  it("handles December to January boundary", () => {
    const december = weekStartsForMonth({ year: 2026, month: 12 });
    const january = weekStartsForMonth({ year: 2027, month: 1 });
    expect(december.at(-1)).toBe("2026-12-28");
    expect(january[0]).toBe("2026-12-28");
    expect(january.at(-1)).toBe("2027-01-25");
  });

  it("handles leap-year February", () => {
    expect(weekStartsForMonth({ year: 2024, month: 2 })).toContain("2024-02-26");
  });

  it("maps calendar dates to API week/day fields", () => {
    expect(calendarDateToWeekDay("2026-08-24")).toEqual({
      weekStartDate: "2026-08-24",
      dayOfWeek: 0,
    });
    expect(calendarDateToWeekDay("2026-08-26")).toEqual({
      weekStartDate: "2026-08-24",
      dayOfWeek: 2,
    });
    expect(calendarDateToWeekDay("2026-08-30")).toEqual({
      weekStartDate: "2026-08-24",
      dayOfWeek: 6,
    });
  });

  it("maps slots back to calendar dates without rollover", () => {
    expect(
      slotToCalendarDate({ weekStartDate: "2026-08-24", dayOfWeek: 6 }),
    ).toBe("2026-08-30");
  });

  it("defaults selected date to today in current month", () => {
    expect(defaultSelectedDateForMonth({ year: 2026, month: 8 }, "2026-08-17")).toBe(
      "2026-08-17",
    );
    expect(defaultSelectedDateForMonth({ year: 2027, month: 1 }, "2026-08-17")).toBe(
      "2027-01-01",
    );
  });

  it("blocks navigating before current Toronto month", () => {
    expect(isBeforeCurrentTorontoMonth({ year: 2026, month: 7 }, "2026-08-17")).toBe(true);
    expect(isBeforeCurrentTorontoMonth({ year: 2026, month: 8 }, "2026-08-17")).toBe(false);
    expect(isBeforeCurrentTorontoMonth({ year: 2027, month: 1 }, "2026-08-17")).toBe(false);
  });

  it("adds months across year boundaries", () => {
    expect(addMonthsToMonthYear({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });
});
