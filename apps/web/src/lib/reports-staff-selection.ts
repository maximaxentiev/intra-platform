const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StaffSelectionMode = "all" | "subset";

export type StaffSelectionState = {
  mode: StaffSelectionMode;
  staffIds: string[];
};

export function parseStaffIdsParam(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function serializeStaffIdsParam(staffIds: string[]): string | undefined {
  const unique = [...new Set(staffIds.filter(Boolean))];
  return unique.length > 0 ? unique.join(",") : undefined;
}

export function resolveAppliedStaffSelection(search: {
  staffIds?: string;
  staffId?: string;
}): StaffSelectionState {
  const fromList = parseStaffIdsParam(search.staffIds);
  if (fromList.length > 0) {
    return { mode: "subset", staffIds: fromList };
  }
  if (search.staffId && UUID_V4.test(search.staffId)) {
    return { mode: "subset", staffIds: [search.staffId] };
  }
  return { mode: "all", staffIds: [] };
}

export function staffSelectionToApiQuery(
  selection: StaffSelectionState,
): { staffIds?: string[] } {
  if (selection.mode === "all" || selection.staffIds.length === 0) {
    return {};
  }
  return { staffIds: selection.staffIds };
}

export function staffSelectionToSearchParams(
  selection: StaffSelectionState,
): { staffIds?: string; staffId?: undefined } {
  if (selection.mode === "all" || selection.staffIds.length === 0) {
    return {};
  }
  return { staffIds: serializeStaffIdsParam(selection.staffIds) };
}

export function staffSelectionLabel(
  selection: StaffSelectionState,
  staffMembers: { id: string; name: string }[],
): string {
  if (selection.mode === "all" || selection.staffIds.length === 0) {
    return "All staff";
  }
  if (selection.staffIds.length === 1) {
    const member = staffMembers.find((entry) => entry.id === selection.staffIds[0]);
    return member?.name ?? "1 staff selected";
  }
  return `${selection.staffIds.length} staff selected`;
}

export function isSingleStaffSelection(selection: StaffSelectionState): boolean {
  return selection.mode === "subset" && selection.staffIds.length === 1;
}
