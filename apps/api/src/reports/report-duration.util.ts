const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export class ReportDurationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportDurationValidationError';
  }
}

/** Normalize repository Shift time strings to HH:mm:ss. */
export function normalizeReportShiftTime(time: string): string {
  const trimmed = time.trim();
  const match = TIME_RE.exec(trimmed);
  if (!match) {
    throw new ReportDurationValidationError(`Invalid wall-clock time "${time}".`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) {
    throw new ReportDurationValidationError(`Invalid wall-clock time "${time}".`);
  }
  return `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`;
}

function timeStringToMinutes(time: string): number {
  const normalized = normalizeReportShiftTime(time);
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Same-day scheduled shift duration in whole minutes.
 * Does not support overnight shifts (end must be after start on the same day).
 */
export function deriveScheduledShiftMinutes(startTime: string, endTime: string): number {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    throw new ReportDurationValidationError('Shift end time must be after start time.');
  }
  return endMinutes - startMinutes;
}
