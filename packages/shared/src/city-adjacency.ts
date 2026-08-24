import { normalizeSupportedCity, SUPPORTED_CITIES, type SupportedCity } from './cities';

/** Undirected operational proximity edges between canonical cities. */
export const CITY_ADJACENCY_EDGES: ReadonlyArray<readonly [SupportedCity, SupportedCity]> = [
  ['Toronto', 'Mississauga'],
  ['Toronto', 'Vaughan'],
  ['Toronto', 'Markham'],
  ['Toronto', 'Richmond Hill'],
  ['Toronto', 'Pickering'],
  ['Mississauga', 'Brampton'],
  ['Mississauga', 'Burlington'],
  ['Brampton', 'Vaughan'],
  ['Brampton', 'Guelph'],
  ['Vaughan', 'Richmond Hill'],
  ['Vaughan', 'Markham'],
  ['Markham', 'Richmond Hill'],
  ['Markham', 'Pickering'],
  ['Pickering', 'Oshawa'],
  ['Oshawa', 'Kawartha Lakes'],
  ['Oshawa', 'Peterborough'],
  ['Burlington', 'Hamilton'],
  ['Burlington', 'Guelph'],
  ['Hamilton', 'Guelph'],
  ['Hamilton', 'Cambridge'],
  ['Hamilton', 'Brantford'],
  ['Hamilton', 'Haldimand County'],
  ['Hamilton', 'St. Catharines'],
  ['Guelph', 'Cambridge'],
  ['Guelph', 'Kitchener'],
  ['Guelph', 'Waterloo'],
  ['Cambridge', 'Kitchener'],
  ['Cambridge', 'Waterloo'],
  ['Cambridge', 'Brantford'],
  ['Cambridge', 'Woodstock'],
  ['Kitchener', 'Waterloo'],
  ['Kitchener', 'Stratford'],
  ['Kitchener', 'Woodstock'],
  ['Waterloo', 'Stratford'],
  ['Brant', 'Brantford'],
  ['Brant', 'Cambridge'],
  ['Brant', 'Norfolk County'],
  ['Brant', 'Haldimand County'],
  ['Brant', 'Woodstock'],
  ['Brantford', 'Woodstock'],
  ['Brantford', 'Norfolk County'],
  ['Brantford', 'Haldimand County'],
  ['Haldimand County', 'Norfolk County'],
  ['Haldimand County', 'Port Colborne'],
  ['Haldimand County', 'Welland'],
  ['St. Catharines', 'Niagara Falls'],
  ['St. Catharines', 'Thorold'],
  ['St. Catharines', 'Welland'],
  ['Thorold', 'Niagara Falls'],
  ['Thorold', 'Welland'],
  ['Thorold', 'Port Colborne'],
  ['Welland', 'Niagara Falls'],
  ['Welland', 'Port Colborne'],
  ['Port Colborne', 'Niagara Falls'],
  ['Stratford', 'Woodstock'],
  ['Stratford', 'London'],
  ['Woodstock', 'London'],
  ['London', 'St. Thomas'],
  ['London', 'Sarnia'],
  ['St. Thomas', 'Windsor'],
  ['Sarnia', 'Windsor'],
  ['Barrie', 'Orillia'],
  ['Barrie', 'Vaughan'],
  ['Barrie', 'Richmond Hill'],
  ['Barrie', 'Owen Sound'],
  ['Barrie', 'Kawartha Lakes'],
  ['Orillia', 'Kawartha Lakes'],
  ['Owen Sound', 'Guelph'],
  ['Kawartha Lakes', 'Peterborough'],
  ['Peterborough', 'Belleville'],
  ['Peterborough', 'Quinte West'],
  ['Belleville', 'Quinte West'],
  ['Belleville', 'Prince Edward County'],
  ['Belleville', 'Kingston'],
  ['Quinte West', 'Prince Edward County'],
  ['Kingston', 'Brockville'],
  ['Brockville', 'Ottawa'],
  ['Brockville', 'Cornwall'],
  ['Ottawa', 'Cornwall'],
  ['Ottawa', 'Clarence-Rockland'],
  ['Ottawa', 'Pembroke'],
  ['Cornwall', 'Clarence-Rockland'],
  ['North Bay', 'Greater Sudbury'],
  ['North Bay', 'Temiskaming Shores'],
  ['Greater Sudbury', 'Elliot Lake'],
  ['Greater Sudbury', 'Timmins'],
  ['Elliot Lake', 'Sault Ste. Marie'],
  ['Timmins', 'Temiskaming Shores'],
  ['Dryden', 'Kenora'],
  ['Dryden', 'Thunder Bay'],
] as const;

const ADJACENCY = new Map<SupportedCity, Set<SupportedCity>>();

for (const city of SUPPORTED_CITIES) {
  ADJACENCY.set(city, new Set());
}

for (const [left, right] of CITY_ADJACENCY_EDGES) {
  ADJACENCY.get(left)!.add(right);
  ADJACENCY.get(right)!.add(left);
}

/** Direct operational neighbors of a canonical city. */
export function adjacentCities(city: SupportedCity): SupportedCity[] {
  return [...(ADJACENCY.get(city) ?? [])].sort();
}

/**
 * Graph distance between two canonical cities.
 * Returns 0, 1, 2, or null when beyond second degree.
 */
export function cityGraphDistance(
  a: SupportedCity,
  b: SupportedCity,
): 0 | 1 | 2 | null {
  if (a === b) return 0;
  if (ADJACENCY.get(a)?.has(b)) return 1;

  for (const neighbor of ADJACENCY.get(a) ?? []) {
    if (ADJACENCY.get(neighbor)?.has(b)) {
      return 2;
    }
  }

  return null;
}

/**
 * Geographic ranking tier for shift matching.
 * 0 = same city, 1 = direct neighbor, 2 = second degree, 3 = unknown/far.
 */
export function geographicTier(
  staffCityInput: string | null | undefined,
  centreCityInput: string | null | undefined,
): 0 | 1 | 2 | 3 {
  const centreCity = normalizeSupportedCity(centreCityInput ?? '');
  if (!centreCity) return 3;

  const staffCity = normalizeSupportedCity(staffCityInput ?? '');
  if (!staffCity) return 3;

  const distance = cityGraphDistance(staffCity, centreCity);
  if (distance === 0) return 0;
  if (distance === 1) return 1;
  if (distance === 2) return 2;
  return 3;
}
