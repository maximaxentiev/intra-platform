import { normalizeSupportedCity, type SupportedCity } from '@intra/shared';

export const MAX_REPORT_CITIES = 52;

/** Parse comma-separated or repeated cities query values into a deduplicated list. */
export function parseReportCities(value: unknown): string[] | undefined {
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

/** Normalize parsed cities to canonical supported spellings; null = no city restriction. */
export function resolveReportCitiesFilter(cities?: SupportedCity[]): SupportedCity[] | null {
  if (!cities?.length) {
    return null;
  }
  return [...new Set(cities)];
}

/** Map raw query tokens to canonical cities for validation transforms. */
export function normalizeReportCitiesList(raw: string[] | undefined): SupportedCity[] | undefined {
  if (!raw?.length) {
    return undefined;
  }

  const canonical: SupportedCity[] = [];
  for (const entry of raw) {
    const city = normalizeSupportedCity(entry);
    if (!city) {
      return raw as unknown as SupportedCity[];
    }
    canonical.push(city);
  }

  return [...new Set(canonical)];
}
