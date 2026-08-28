import { formatShiftRoleLabel } from "@/lib/shift-role-ui";

export type ShiftAssignmentConfirmDetails = {
  staffLegalName: string;
  centreName: string;
  dateLabel: string;
  timeLabel: string;
  roleLabel: string;
};

function formatTimeDisplay(hhmm: string): string {
  const normalized = hhmm.slice(0, 5);
  const [hRaw, mRaw] = normalized.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return normalized;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Toronto-style calendar date for assignment confirmation (e.g. August 29, 2026). */
export function formatShiftAssignmentDateLabel(shiftDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(shiftDate);
  if (!match) return shiftDate;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShiftAssignmentTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeDisplay(startTime)}–${formatTimeDisplay(endTime)}`;
}

export function buildShiftAssignmentConfirmDetails(input: {
  staffLegalName: string;
  centreName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
}): ShiftAssignmentConfirmDetails {
  return {
    staffLegalName: input.staffLegalName,
    centreName: input.centreName,
    dateLabel: formatShiftAssignmentDateLabel(input.shiftDate),
    timeLabel: formatShiftAssignmentTimeRange(input.startTime, input.endTime),
    roleLabel: formatShiftRoleLabel(input.roleNeeded) || input.roleNeeded || "—",
  };
}
