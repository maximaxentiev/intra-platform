const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_REPORT_CENTRE_IDS = 100;

/** Parse comma-separated or repeated centreIds query values into deduplicated UUID v4 list. */
export function parseReportCentreIds(value: unknown): string[] | undefined {
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

export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}

/** Resolve Centre Usage centre filter: null = all centres. */
export function resolveCentreUsageCentreIds(input: {
  centreIds?: string[];
  centreId?: string;
}): string[] | null {
  const fromList = input.centreIds?.length ? [...new Set(input.centreIds)] : null;
  if (fromList?.length) {
    return fromList;
  }
  if (input.centreId) {
    return [input.centreId];
  }
  return null;
}
