/** Convert UI hours input to integer minutes for API query params. */
export function parseHoursInputToMinutes(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 60);
}

/** Convert API minutes back to hours string for form display. */
export function minutesToHoursInput(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  return String(minutes / 60);
}

export function parseOptionalCountInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

export function parseOptionalPercentInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return undefined;
  return parsed;
}
