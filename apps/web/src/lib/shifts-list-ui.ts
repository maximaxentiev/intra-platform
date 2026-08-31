import type { ShiftStatus } from "@/lib/db";
import {
  centreSelectionLabel,
  centreSelectionToApiQuery,
  centreSelectionToSearchParams,
  hasExplicitCentreSelection,
  resolveAppliedCentreSelection,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";

/**
 * Presentation helpers for the Ops Shifts list.
 *
 * Pure display logic only — no filtering, no business rules, no API calls.
 * The shift list API stays the single source of truth for results.
 */

export type ShiftFilterState = {
  from: string;
  to: string;
  centres: CentreSelectionState;
  status: ShiftStatus | "all";
  staffId: string;
  staffpoint: "all" | "yes" | "no";
};

export type ShiftFilterChipKey = "dates" | "centre" | "status" | "staff" | "staffpoint";

export type ShiftFilterChipDescriptor = {
  id: ShiftFilterChipKey;
  field: string;
  label: string;
};

export const EMPTY_SHIFT_FILTERS: ShiftFilterState = {
  from: "",
  to: "",
  centres: { mode: "all", centreIds: [] },
  status: "all",
  staffId: "all",
  staffpoint: "all",
};

const STATUS_LABELS: Record<ShiftStatus, string> = {
  pending: "Pending",
  filled: "Filled",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** Formats an ISO `YYYY-MM-DD` date without crossing a timezone boundary. */
export function formatShiftDateLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateRangeLabel(from: string, to: string): string | null {
  if (from && to) return `${formatShiftDateLabel(from)} – ${formatShiftDateLabel(to)}`;
  if (from) return `From ${formatShiftDateLabel(from)}`;
  if (to) return `Until ${formatShiftDateLabel(to)}`;
  return null;
}

/** True when any filter differs from its default "everything" value. */
export function hasActiveShiftFilters(state: ShiftFilterState): boolean {
  return (
    state.from !== "" ||
    state.to !== "" ||
    hasExplicitCentreSelection(state.centres) ||
    state.status !== "all" ||
    state.staffId !== "all" ||
    state.staffpoint !== "all"
  );
}

/**
 * Builds readable chips for the filters that are actually constraining results.
 * Default values ("All centres", "All statuses", "Anyone") never produce a chip.
 */
export function buildShiftFilterChips(
  state: ShiftFilterState,
  lookups: {
    centres?: { id: string; name: string }[];
    staffName?: (id: string) => string | undefined;
  } = {},
): ShiftFilterChipDescriptor[] {
  const chips: ShiftFilterChipDescriptor[] = [];

  const dates = dateRangeLabel(state.from, state.to);
  if (dates) chips.push({ id: "dates", field: "Dates", label: dates });

  if (hasExplicitCentreSelection(state.centres)) {
    chips.push({
      id: "centre",
      field: "Centres",
      label: centreSelectionLabel(state.centres, lookups.centres ?? []),
    });
  }

  if (state.status !== "all") {
    chips.push({ id: "status", field: "Status", label: STATUS_LABELS[state.status] });
  }

  if (state.staffId !== "all") {
    chips.push({
      id: "staff",
      field: "Assigned to",
      label: lookups.staffName?.(state.staffId) ?? "Selected staff",
    });
  }

  if (state.staffpoint !== "all") {
    chips.push({
      id: "staffpoint",
      field: "Staffpoint",
      label: state.staffpoint === "yes" ? "Added" : "Not added",
    });
  }

  return chips;
}

/** Returns the filter state with a single chip's filter reset to its default. */
export function clearShiftFilterChip(
  state: ShiftFilterState,
  chip: ShiftFilterChipKey,
): ShiftFilterState {
  switch (chip) {
    case "dates":
      return { ...state, from: "", to: "" };
    case "centre":
      return { ...state, centres: { mode: "all", centreIds: [] } };
    case "status":
      return { ...state, status: "all" };
    case "staff":
      return { ...state, staffId: "all" };
    case "staffpoint":
      return { ...state, staffpoint: "all" };
    default:
      return state;
  }
}

/** Maps filter state onto the existing URL search schema (undefined = absent). */
export function shiftFiltersToSearch(
  state: ShiftFilterState,
  pagination?: { page?: number; pageSize?: number },
) {
  return {
    from: state.from || undefined,
    to: state.to || undefined,
    ...centreSelectionToSearchParams(state.centres),
    status: state.status === "all" ? undefined : state.status,
    staff: state.staffId === "all" ? undefined : state.staffId,
    staffpoint: state.staffpoint === "all" ? undefined : state.staffpoint,
    page: pagination?.page && pagination.page > 1 ? pagination.page : undefined,
    pageSize:
      pagination?.pageSize && pagination.pageSize !== 25 ? pagination.pageSize : undefined,
  };
}

/** Resolves URL search params into applied centre selection (supports legacy `centre`). */
export function shiftCentreSelectionFromSearch(search: {
  centreIds?: string;
  centre?: string;
}): CentreSelectionState {
  return resolveAppliedCentreSelection({
    centreIds: search.centreIds,
    centreId: search.centre,
  });
}

/** Maps applied centre selection to shift list API query params. */
export function shiftCentreSelectionToApiQuery(state: ShiftFilterState) {
  return centreSelectionToApiQuery(state.centres);
}

export function feedResultCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

/** @deprecated Use feedResultCountLabel for grouped feed pages. */
export function shiftResultCountLabel(count: number): string {
  return `${count} shift${count === 1 ? "" : "s"}`;
}

/** Copy for the assignee cell. Unassigned pending work reads as actionable. */
export function shiftAssigneeLabel(
  assignedName: string | null,
  status: ShiftStatus,
): { text: string; needsStaff: boolean } {
  if (assignedName) return { text: assignedName, needsStaff: false };
  if (status === "pending") return { text: "Needs staff", needsStaff: true };
  return { text: "Unassigned", needsStaff: false };
}
