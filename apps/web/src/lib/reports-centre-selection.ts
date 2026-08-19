const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CentreSelectionMode = "all" | "subset";

export type CentreSelectionState = {
  mode: CentreSelectionMode;
  centreIds: string[];
};

export function parseCentreIdsParam(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function serializeCentreIdsParam(centreIds: string[]): string | undefined {
  const unique = [...new Set(centreIds.filter(Boolean))];
  return unique.length > 0 ? unique.join(",") : undefined;
}

export function resolveAppliedCentreSelection(search: {
  centreIds?: string;
  centreId?: string;
}): CentreSelectionState {
  const fromList = parseCentreIdsParam(search.centreIds);
  if (fromList.length > 0) {
    return { mode: "subset", centreIds: fromList };
  }
  if (search.centreId && UUID_V4.test(search.centreId)) {
    return { mode: "subset", centreIds: [search.centreId] };
  }
  return { mode: "all", centreIds: [] };
}

export function centreSelectionToApiQuery(
  selection: CentreSelectionState,
): { centreIds?: string[] } {
  if (selection.mode === "all" || selection.centreIds.length === 0) {
    return {};
  }
  return { centreIds: selection.centreIds };
}

export function centreSelectionToSearchParams(
  selection: CentreSelectionState,
): { centreIds?: string; centreId?: undefined } {
  if (selection.mode === "all" || selection.centreIds.length === 0) {
    return {};
  }
  return { centreIds: serializeCentreIdsParam(selection.centreIds) };
}

export function centreSelectionLabel(
  selection: CentreSelectionState,
  centres: { id: string; name: string }[],
): string {
  if (selection.mode === "all" || selection.centreIds.length === 0) {
    return "All centres";
  }
  if (selection.centreIds.length === 1) {
    const centre = centres.find((entry) => entry.id === selection.centreIds[0]);
    return centre?.name ?? "1 centre selected";
  }
  return `${selection.centreIds.length} centres selected`;
}

export function isSingleCentreSelection(selection: CentreSelectionState): boolean {
  return selection.mode === "subset" && selection.centreIds.length === 1;
}
