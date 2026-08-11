/**
 * Canonical supported cities for staff, centres, and carer profiles.
 * Business-approved list — do not accept free-text cities outside this catalog.
 */
export const SUPPORTED_CITIES = [
  'Barrie',
  'Belleville',
  'Brampton',
  'Brant',
  'Brantford',
  'Brockville',
  'Burlington',
  'Cambridge',
  'Clarence-Rockland',
  'Cornwall',
  'Dryden',
  'Elliot Lake',
  'Greater Sudbury',
  'Guelph',
  'Haldimand County',
  'Hamilton',
  'Kawartha Lakes',
  'Kenora',
  'Kingston',
  'Kitchener',
  'London',
  'Markham',
  'Mississauga',
  'Niagara Falls',
  'Norfolk County',
  'North Bay',
  'Orillia',
  'Oshawa',
  'Ottawa',
  'Owen Sound',
  'Pembroke',
  'Peterborough',
  'Pickering',
  'Port Colborne',
  'Prince Edward County',
  'Quinte West',
  'Richmond Hill',
  'Sarnia',
  'Sault Ste. Marie',
  'St. Catharines',
  'St. Thomas',
  'Stratford',
  'Temiskaming Shores',
  'Thorold',
  'Thunder Bay',
  'Timmins',
  'Toronto',
  'Vaughan',
  'Waterloo',
  'Welland',
  'Windsor',
  'Woodstock',
] as const;

export type SupportedCity = (typeof SUPPORTED_CITIES)[number];

export const UNSUPPORTED_CITY_MESSAGE =
  'City must be selected from the supported city list.';

const LOOKUP = new Map<string, SupportedCity>(
  SUPPORTED_CITIES.map((city) => [city.toLowerCase(), city]),
);

/** Case-insensitive match to a canonical city spelling, or null when unknown. */
export function normalizeSupportedCity(input: string): SupportedCity | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return LOOKUP.get(trimmed.toLowerCase()) ?? null;
}

export function isSupportedCity(input: string): boolean {
  return normalizeSupportedCity(input) !== null;
}

/** New or changed city values must resolve to the canonical catalog. */
export function resolveCityForCreate(input: string): SupportedCity | null {
  return normalizeSupportedCity(input);
}

/**
 * Allows unchanged legacy city values to persist; changed values must match the catalog.
 */
export function resolveCityForUpdate(
  nextCity: string,
  previousCity: string,
): { ok: true; city: string } | { ok: false; message: string } {
  const trimmedNext = nextCity.trim();
  if (!trimmedNext) {
    return { ok: false, message: 'City is required.' };
  }
  const normalized = normalizeSupportedCity(trimmedNext);
  if (normalized) {
    return { ok: true, city: normalized };
  }
  if (trimmedNext === previousCity.trim()) {
    return { ok: true, city: previousCity.trim() };
  }
  return { ok: false, message: UNSUPPORTED_CITY_MESSAGE };
}

/** Filter cities for searchable comboboxes (case-insensitive substring match). */
export function filterSupportedCities(query: string): SupportedCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SUPPORTED_CITIES];
  return SUPPORTED_CITIES.filter((city) => city.toLowerCase().includes(q));
}

/** Options shown in UI — includes a legacy value until the user selects a canonical city. */
export function cityComboboxOptions(currentValue: string): string[] {
  const trimmed = currentValue.trim();
  if (!trimmed || isSupportedCity(trimmed)) {
    return [...SUPPORTED_CITIES];
  }
  return [trimmed, ...SUPPORTED_CITIES.filter((c) => c !== trimmed)];
}
