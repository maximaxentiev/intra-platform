import { geographicTier } from './city-adjacency';

export type StaffMatchingSortInput = {
  isTop: boolean;
  legalName: string;
  city: string | null;
};

/** Sort eligible staff: Top first, then geographic tier, then legal name. */
export function compareStaffMatchingSort(
  a: StaffMatchingSortInput,
  b: StaffMatchingSortInput,
  centreCity: string | null,
): number {
  if (a.isTop !== b.isTop) {
    return a.isTop ? -1 : 1;
  }

  const geo =
    geographicTier(a.city, centreCity) - geographicTier(b.city, centreCity);
  if (geo !== 0) {
    return geo;
  }

  return a.legalName.localeCompare(b.legalName);
}
