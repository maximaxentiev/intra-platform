/** Ops report display semantics — always America/Toronto, never browser-local. */
export const OPS_REPORT_TIMEZONE = "America/Toronto";

export function formatOpsDateToronto(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_REPORT_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatOpsDateTimeToronto(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_REPORT_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Compact audit-log timestamp — omits year when it matches current Toronto year. */
export function formatOpsCompactDateTimeToronto(
  isoOrDate: string | Date,
  now: Date = new Date(),
): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const currentYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_REPORT_TIMEZONE,
    year: "numeric",
  }).format(now);
  const eventYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_REPORT_TIMEZONE,
    year: "numeric",
  }).format(date);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_REPORT_TIMEZONE,
    year: currentYear === eventYear ? undefined : "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Integer minutes → readable duration (never decimal hours). */
export function formatReportDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error("minutes must be a non-negative finite number.");
  }
  const wholeMinutes = Math.trunc(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

/** One decimal place for fill rate display. */
export function formatReportFillRatePercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value}%`;
}
