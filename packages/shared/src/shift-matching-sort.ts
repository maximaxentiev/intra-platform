import { geographicTier } from './city-adjacency';

export type StaffMatchingSortInput = {
  isTop: boolean;
  legalName: string;
  city: string | null;
  /** Higher values sort earlier within the same Top + geographic tier. */
  qualificationPreferenceRank?: number;
};

/** Sort eligible staff: Top → geographic tier → qualification preference → legal name. */
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

  const aQual = a.qualificationPreferenceRank ?? 0;
  const bQual = b.qualificationPreferenceRank ?? 0;
  if (aQual !== bQual) {
    return bQual - aQual;
  }

  return a.legalName.localeCompare(b.legalName);
}
