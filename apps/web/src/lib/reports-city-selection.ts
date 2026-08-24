import { SUPPORTED_CITIES, type SupportedCity } from "@intra/shared";

export type CitySelectionMode = "all" | "subset";

export type CitySelectionState = {
  mode: CitySelectionMode;
  cities: SupportedCity[];
};

export function parseCitiesParam(value: string | undefined): SupportedCity[] {
  if (!value?.trim()) {
    return [];
  }

  const lookup = new Map(SUPPORTED_CITIES.map((city) => [city.toLowerCase(), city]));
  const parsed: SupportedCity[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const canonical = lookup.get(trimmed.toLowerCase());
    if (canonical) {
      parsed.push(canonical);
    }
  }
  return [...new Set(parsed)];
}

export function serializeCitiesParam(cities: SupportedCity[]): string | undefined {
  const unique = [...new Set(cities.filter(Boolean))];
  return unique.length > 0 ? unique.join(",") : undefined;
}

export function resolveAppliedCitySelection(search: { cities?: string }): CitySelectionState {
  const fromList = parseCitiesParam(search.cities);
  if (fromList.length > 0) {
    return { mode: "subset", cities: fromList };
  }
  return { mode: "all", cities: [] };
}

export function citySelectionToApiQuery(
  selection: CitySelectionState,
): { cities?: SupportedCity[] } {
  if (selection.mode === "all" || selection.cities.length === 0) {
    return {};
  }
  return { cities: selection.cities };
}

export function citySelectionToSearchParams(
  selection: CitySelectionState,
): { cities?: string } {
  if (selection.mode === "all" || selection.cities.length === 0) {
    return {};
  }
  return { cities: serializeCitiesParam(selection.cities) };
}

export function citySelectionLabel(selection: CitySelectionState): string {
  if (selection.mode === "all" || selection.cities.length === 0) {
    return "All cities";
  }
  if (selection.cities.length === 1) {
    return selection.cities[0]!;
  }
  return `${selection.cities.length} cities selected`;
}

export function hasExplicitCitySelection(selection: CitySelectionState): boolean {
  return selection.mode === "subset" && selection.cities.length > 0;
}

export { SUPPORTED_CITIES };
