export const MAX_REPORT_STAFF_IDS = 100;

/** Parse comma-separated or repeated staffIds query values into deduplicated UUID list. */
export function parseReportStaffIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawParts = Array.isArray(value)
    ? value.flatMap((entry) => String(entry).split(','))
    : String(value).split(',');

  const normalized = [...new Set(rawParts.map((part) => part.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

/** Resolve Staff Usage staff filter: null = all staff. */
export function resolveStaffUsageStaffIds(input: {
  staffIds?: string[];
  staffId?: string;
}): string[] | null {
  const fromList = input.staffIds?.length ? [...new Set(input.staffIds)] : null;
  if (fromList?.length) {
    return fromList;
  }
  if (input.staffId) {
    return [input.staffId];
  }
  return null;
}
