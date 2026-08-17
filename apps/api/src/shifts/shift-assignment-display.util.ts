import { parseCalendarDateString } from '../availability/availability-toronto.util';

/** Friendly full calendar date for assignment confirmation emails. */
export function formatShiftAssignmentDateLabel(shiftDate: string): string {
  const { year, month, day } = parseCalendarDateString(String(shiftDate));
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShiftAssignmentTimeDisplay(hhmm: string): string {
  const normalized = hhmm.slice(0, 5);
  const [hRaw, mRaw] = normalized.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return normalized;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatShiftAssignmentTimeRange(startTime: string, endTime: string): string {
  return `${formatShiftAssignmentTimeDisplay(startTime)} – ${formatShiftAssignmentTimeDisplay(endTime)}`;
}

export function normalizeShiftRoleNeeded(roleNeeded: string | null | undefined): string | null {
  const trimmed = (roleNeeded ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
