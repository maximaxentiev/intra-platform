/** Ontario workplace timezone — matches backend availability semantics. */
export const AVAILABILITY_TIMEZONE = "America/Toronto";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function torontoTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AVAILABILITY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseCalendarDateString(value: string): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  return { year, month, day };
}

function formatUtcParts(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Monday-based day index: 0 = Monday … 6 = Sunday. */
export function calendarDateFromWeekDay(weekStartDate: string, dayOfWeek: number): string {
  const { year, month, day } = parseCalendarDateString(weekStartDate);
  const probe = new Date(Date.UTC(year, month - 1, day + dayOfWeek));
  return formatUtcParts(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
}

export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isPastCalendarDate(dateStr: string, today = torontoTodayDateString()): boolean {
  return compareDateStrings(dateStr, today) < 0;
}

export function isTodayCalendarDate(dateStr: string, today = torontoTodayDateString()): boolean {
  return dateStr === today;
}

/** Monday week start for the calendar date containing `dateStr`. */
export function mondayOfDateString(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const jsDay = probe.getUTCDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(Date.UTC(year, month - 1, day + diff));
  return formatUtcParts(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

export function currentMondayWeekStart(today = torontoTodayDateString()): string {
  return mondayOfDateString(today);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const probe = new Date(Date.UTC(year, month - 1, day + days));
  return formatUtcParts(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
}

export function formatShortCalendarDate(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatWeekRangeLabel(weekStartDate: string): string {
  const weekEnd = addDaysToDateString(weekStartDate, 6);
  const start = formatShortCalendarDate(weekStartDate);
  const end = formatShortCalendarDate(weekEnd);
  return `${start} – ${end}`;
}

export function formatAvailabilityTimeDisplay(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatAvailabilityWindowDisplay(startTime: string, endTime: string): string {
  return `${formatAvailabilityTimeDisplay(startTime)} – ${formatAvailabilityTimeDisplay(endTime)}`;
}

export const CARER_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type MonthYear = {
  year: number;
  /** 1–12 */
  month: number;
};

export function currentTorontoMonthYear(today = torontoTodayDateString()): MonthYear {
  const { year, month } = parseCalendarDateString(today);
  return { year, month };
}

export function compareMonthYear(a: MonthYear, b: MonthYear): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function isBeforeCurrentTorontoMonth(
  monthYear: MonthYear,
  today = torontoTodayDateString(),
): boolean {
  return compareMonthYear(monthYear, currentTorontoMonthYear(today)) < 0;
}

export function addMonthsToMonthYear(monthYear: MonthYear, delta: number): MonthYear {
  const probe = new Date(Date.UTC(monthYear.year, monthYear.month - 1 + delta, 1));
  return {
    year: probe.getUTCFullYear(),
    month: probe.getUTCMonth() + 1,
  };
}

export function formatMonthYearLabel(monthYear: MonthYear): string {
  return new Date(monthYear.year, monthYear.month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function firstDayOfMonth(monthYear: MonthYear): string {
  return formatUtcParts(monthYear.year, monthYear.month, 1);
}

export function lastDayOfMonth(monthYear: MonthYear): string {
  const probe = new Date(Date.UTC(monthYear.year, monthYear.month, 0));
  return formatUtcParts(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
}

/** Monday week starts for every week intersecting the calendar month. */
export function weekStartsForMonth(monthYear: MonthYear): string[] {
  const monthStart = firstDayOfMonth(monthYear);
  const monthEnd = lastDayOfMonth(monthYear);
  const weekStarts: string[] = [];
  let weekStart = mondayOfDateString(monthStart);

  while (compareDateStrings(weekStart, monthEnd) <= 0) {
    weekStarts.push(weekStart);
    weekStart = addDaysToDateString(weekStart, 7);
  }

  return weekStarts;
}

export function calendarDateToWeekDay(calendarDate: string): {
  weekStartDate: string;
  dayOfWeek: number;
} {
  const weekStartDate = mondayOfDateString(calendarDate);
  const startParts = parseCalendarDateString(weekStartDate);
  const dateParts = parseCalendarDateString(calendarDate);
  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const dateUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
  const dayOfWeek = Math.round((dateUtc - startUtc) / (24 * 60 * 60 * 1000));
  return { weekStartDate, dayOfWeek };
}

export function slotToCalendarDate(slot: {
  weekStartDate: string;
  dayOfWeek: number;
}): string {
  return calendarDateFromWeekDay(slot.weekStartDate, slot.dayOfWeek);
}

export function dateStringToLocalDate(dateStr: string): Date {
  const { year, month, day } = parseCalendarDateString(dateStr);
  return new Date(year, month - 1, day);
}

export function localDateToDateString(date: Date): string {
  return formatUtcParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function formatFullCalendarDateLabel(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatFullCalendarDateWithYearLabel(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function defaultSelectedDateForMonth(
  monthYear: MonthYear,
  today = torontoTodayDateString(),
): string {
  if (compareMonthYear(monthYear, currentTorontoMonthYear(today)) === 0) {
    return today;
  }
  return firstDayOfMonth(monthYear);
}

export function isBeforeCurrentTorontoWeek(
  weekStartDate: string,
  today = torontoTodayDateString(),
): boolean {
  return compareDateStrings(weekStartDate, currentMondayWeekStart(today)) < 0;
}

export function weekDayDates(weekStartDate: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(weekStartDate, index));
}

export function formatCompactWeekDayLabel(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  const weekday = new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
  });
  return `${weekday} ${day}`;
}

export function formatDashboardAvailabilityDateLabel(dateStr: string): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isDateInMonthYear(dateStr: string, monthYear: MonthYear): boolean {
  const { year, month } = parseCalendarDateString(dateStr);
  return year === monthYear.year && month === monthYear.month;
}
