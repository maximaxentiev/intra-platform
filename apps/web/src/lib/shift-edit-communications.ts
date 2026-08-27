import { normalizeShiftRole } from "@intra/shared";
import { formatShiftRoleLabel } from "@/lib/shift-role-ui";

export type ShiftCommunicationField = "date" | "time" | "role";

export type ShiftCommunicationSnapshot = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
};

export type ShiftCommunicationChange = {
  field: ShiftCommunicationField;
  label: string;
  beforeDisplay: string;
  afterDisplay: string;
};

function formatDateLabel(shiftDate: string): string {
  const [year, month, day] = shiftDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeDisplay(startTime)}–${formatTimeDisplay(endTime)}`;
}

export function detectShiftEditCommunicationChanges(
  before: ShiftCommunicationSnapshot,
  after: ShiftCommunicationSnapshot,
): ShiftCommunicationChange[] {
  const changes: ShiftCommunicationChange[] = [];

  if (before.shiftDate !== after.shiftDate) {
    changes.push({
      field: "date",
      label: "Date",
      beforeDisplay: formatDateLabel(before.shiftDate),
      afterDisplay: formatDateLabel(after.shiftDate),
    });
  }

  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    changes.push({
      field: "time",
      label: "Time",
      beforeDisplay: formatTimeRange(before.startTime, before.endTime),
      afterDisplay: formatTimeRange(after.startTime, after.endTime),
    });
  }

  const beforeRole = normalizeShiftRole(before.roleNeeded) ?? "";
  const afterRole = normalizeShiftRole(after.roleNeeded) ?? "";
  if (beforeRole !== afterRole) {
    changes.push({
      field: "role",
      label: "Role required",
      beforeDisplay: formatShiftRoleLabel(beforeRole),
      afterDisplay: formatShiftRoleLabel(afterRole),
    });
  }

  return changes;
}

export function hasShiftEditCommunicationChanges(changes: readonly ShiftCommunicationChange[]): boolean {
  return changes.length > 0;
}

export function formatShiftChangeArrow(change: ShiftCommunicationChange): string {
  return `${change.beforeDisplay} → ${change.afterDisplay}`;
}

export type ShiftUpdateCommunicationsPayload = {
  centre?: { send: boolean; include: Partial<Record<ShiftCommunicationField, boolean>> };
  carer?: { send: boolean; include: Partial<Record<ShiftCommunicationField, boolean>> };
};

export function defaultIncludeForChanges(
  changes: readonly ShiftCommunicationChange[],
): Partial<Record<ShiftCommunicationField, boolean>> {
  const include: Partial<Record<ShiftCommunicationField, boolean>> = {};
  for (const change of changes) {
    include[change.field] = true;
  }
  return include;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCommunicationEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim() ?? "";
  if (!normalized || normalized.length > 320) return false;
  return EMAIL_RE.test(normalized);
}

export function resolveCarerCommunicationEmail(staff: {
  email: string;
  portalAccount?: { email: string | null } | null;
}): string | null {
  const accountEmail = staff.portalAccount?.email?.trim();
  if (accountEmail && isValidCommunicationEmail(accountEmail)) return accountEmail;
  const staffEmail = staff.email?.trim();
  if (staffEmail && isValidCommunicationEmail(staffEmail)) return staffEmail;
  return null;
}
