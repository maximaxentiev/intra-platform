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
