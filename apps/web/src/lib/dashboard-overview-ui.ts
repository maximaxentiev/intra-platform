import type {
  DashboardOverviewResponse,
  DashboardUrgentPendingShiftItem,
} from "./dashboard-api";

/** Dashboard display semantics are always America/Toronto. */
export const DASHBOARD_TIMEZONE = "America/Toronto";

/** "Friday, August 21 · Toronto" from a YYYY-MM-DD Toronto business date. */
export function formatDashboardHeaderDate(dateOnly: string): string {
  const label = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
  return `${label} · Toronto`;
}

/** 24h "HH:MM[:SS]" -> "9:00 AM". */
export function formatShiftClock(time: string | null | undefined): string {
  if (!time) return "—";
  const [rawH, rawM] = time.split(":");
  const h = Number(rawH);
  const m = Number(rawM ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatShiftTimeRange(startTime: string, endTime: string): string {
  return `${formatShiftClock(startTime)} – ${formatShiftClock(endTime)}`;
}

/** Humanised duration for urgency copy: 95 -> "1h 35m", 45 -> "45m". */
export function formatDurationMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(Math.abs(minutes)));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type ShiftUrgencyLevel = "critical" | "soon" | "upcoming";

export interface ShiftUrgency {
  label: string;
  level: ShiftUrgencyLevel;
  /** True when the shift start is already in the past. */
  overdue: boolean;
}

/**
 * Urgency copy derived from the server-provided minutesUntilStart.
 * Never renders raw negative minutes.
 */
export function describeShiftUrgency(
  minutesUntilStart: number,
  options: { unfilled?: boolean } = {},
): ShiftUrgency {
  const unfilled = options.unfilled ?? false;
  if (minutesUntilStart < 0) {
    const base = `Started ${formatDurationMinutes(minutesUntilStart)} ago`;
    return {
      label: unfilled ? `${base} · Still unfilled` : base,
      level: "critical",
      overdue: true,
    };
  }
  const label = `Starts in ${formatDurationMinutes(minutesUntilStart)}`;
  return {
    label,
    level: minutesUntilStart <= 120 ? "critical" : minutesUntilStart <= 480 ? "soon" : "upcoming",
    overdue: false,
  };
}

export function urgentPendingShiftSummary(shift: DashboardUrgentPendingShiftItem): string {
  return `${shift.role} · ${formatShiftClock(shift.startTime)}`;
}

/** Document attention lines — only counts greater than zero are surfaced. */
export function documentAttentionMessages(documents: {
  pendingReview: number;
  issueFlagged: number;
  expired: number;
}): string[] {
  const messages: string[] = [];
  if (documents.pendingReview > 0) {
    messages.push(
      `${documents.pendingReview} staff ${documents.pendingReview === 1 ? "document" : "documents"} awaiting review`,
    );
  }
  if (documents.issueFlagged > 0) {
    messages.push(
      `${documents.issueFlagged} staff ${documents.issueFlagged === 1 ? "has" : "have"} flagged document issues`,
    );
  }
  if (documents.expired > 0) {
    messages.push(
      `${documents.expired} staff ${documents.expired === 1 ? "has" : "have"} expired required documents`,
    );
  }
  return messages;
}

export function communicationAttentionMessage(totalFailures: number): string | null {
  if (totalFailures <= 0) return null;
  return `${totalFailures} ${totalFailures === 1 ? "communication needs" : "communications need"} attention`;
}

const COMMUNICATION_TYPE_LABELS: Record<string, string> = {
  assignment_confirmation: "Assignment confirmation",
  automated_communication: "Automated communication",
};

export function communicationFailureLabel(failure: {
  type: "assignment_confirmation" | "automated_communication";
  centreName: string | null;
  staffName: string | null;
}): string {
  const base = COMMUNICATION_TYPE_LABELS[failure.type] ?? "Communication";
  const who = failure.staffName ?? failure.centreName;
  return who ? `${base} · ${who}` : base;
}

/** True when any section of Needs attention has something to show. */
export function hasAttentionItems(attention: DashboardOverviewResponse["attention"]): boolean {
  return (
    attention.totalUrgentPendingCount > 0 ||
    attention.urgentPendingShifts.length > 0 ||
    documentAttentionMessages(attention.documents).length > 0 ||
    attention.communications.totalFailures > 0
  );
}

/** Fill rate display — null renders an em dash, never 0%. */
export function formatFillRate(fillRate: number | null): string {
  if (fillRate === null || Number.isNaN(fillRate)) return "—";
  const pct = fillRate <= 1 ? fillRate * 100 : fillRate;
  return `${Math.round(pct)}%`;
}

/** "Tomorrow", "Today", or "Sat, Aug 23" for an upcoming Toronto business date. */
export function formatUpcomingDateLabel(
  dateOnly: string,
  context: { today: string; tomorrow: string },
): string {
  if (dateOnly === context.today) return "Today";
  if (dateOnly === context.tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

/** Toronto clock time for an activity/failure instant: "10:42 AM". */
export function formatDashboardInstantTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function activityActorLine(item: {
  occurredAt: string;
  actor: { name: string | null; type: string };
}): string {
  const time = formatDashboardInstantTime(item.occurredAt);
  if (item.actor.name) return `${time} · by ${item.actor.name}`;
  if (item.actor.type === "system") return `${time} · by system`;
  return time;
}

export type ShiftsSearch = {
  from?: string;
  to?: string;
  status?: "pending" | "filled" | "cancelled" | "completed";
};

/** Links into the existing /shifts filters only — no new query parameters. */
export function todayShiftsSearch(
  today: string,
  status?: ShiftsSearch["status"],
): ShiftsSearch {
  return status ? { from: today, to: today, status } : { from: today, to: today };
}

export function next7DaysShiftsSearch(
  next7: { dateFrom: string; dateTo: string },
  status?: ShiftsSearch["status"],
): ShiftsSearch {
  return status
    ? { from: next7.dateFrom, to: next7.dateTo, status }
    : { from: next7.dateFrom, to: next7.dateTo };
}

/** Compliance headline: "247 compliant of 263 staff members". */
export function complianceHeadline(documents: {
  compliant: number;
  staffShown: number;
}): { value: string; context: string } {
  return {
    value: `${documents.compliant} compliant`,
    context: `of ${documents.staffShown} staff members`,
  };
}

export function pluralizeStaff(count: number): string {
  return count === 1 ? "1 staff member" : `${count} staff members`;
}

/** Copy for the Next 7 Days list: distinguishes "nothing scheduled" from "all covered". */
export function next7DaysCoverageMessage(next7Days: {
  total: number;
  pending: number;
}): string | null {
  if (next7Days.total === 0) return "No shifts scheduled in the next 7 days.";
  if (next7Days.pending === 0) return "All upcoming shifts are currently covered.";
  return null;
}

/** Unambiguous staff readiness headline: "1 staff member". */
export function staffReadinessHeadline(staffCount: number): string {
  return staffCount === 1 ? "1 staff member" : `${staffCount} staff members`;
}

/**
 * Neutral explanation when staff exceeds compliant staff but no issue
 * counters explain the gap. Purely derived from values already returned.
 */
export function unexplainedComplianceNote(documents: {
  compliant: number;
  staffShown: number;
  pendingReview: number;
  issueFlagged: number;
  expired: number;
}): string | null {
  const gap = documents.staffShown - documents.compliant;
  if (gap <= 0) return null;
  if (documents.pendingReview > 0 || documents.issueFlagged > 0 || documents.expired > 0) {
    return null;
  }
  return `${pluralizeStaff(gap)} ${gap === 1 ? "is" : "are"} not fully compliant. Review compliance for missing or incomplete requirements.`;
}
