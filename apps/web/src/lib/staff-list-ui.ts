import { displayStaff, type Staff } from "@/lib/db";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  type PortalAccountDisplayStatus,
} from "@/lib/portal-account-status";

/**
 * Presentation helpers for the Ops Staff directory.
 *
 * Pure display + client-side filtering logic that mirrors the existing
 * live-filter semantics exactly. No API calls, no new business rules.
 */

export type StaffFilterState = {
  q: string;
  role: string;
  portal: "all" | PortalAccountDisplayStatus;
};

export const EMPTY_STAFF_FILTERS: StaffFilterState = {
  q: "",
  role: "all",
  portal: "all",
};

export type StaffFilterChipKey = "search" | "role" | "portal";

export type StaffFilterChipDescriptor = {
  id: StaffFilterChipKey;
  field: string;
  label: string;
};

export function staffPortalStatusOf(s: Staff): PortalAccountDisplayStatus {
  return (s.portalAccountStatus ?? "no_account") as PortalAccountDisplayStatus;
}

/** True when any control differs from its default "everything" value. */
export function hasActiveStaffFilters(state: StaffFilterState): boolean {
  return state.q.trim() !== "" || state.role !== "all" || state.portal !== "all";
}

/** Chips for non-default filters only. */
export function buildStaffFilterChips(state: StaffFilterState): StaffFilterChipDescriptor[] {
  const chips: StaffFilterChipDescriptor[] = [];
  if (state.q.trim() !== "") {
    chips.push({ id: "search", field: "Search", label: state.q.trim() });
  }
  if (state.role !== "all") {
    chips.push({ id: "role", field: "Role", label: state.role });
  }
  if (state.portal !== "all") {
    chips.push({
      id: "portal",
      field: "Portal",
      label: PORTAL_ACCOUNT_STATUS_LABELS[state.portal],
    });
  }
  return chips;
}

/** Clears exactly one live filter, leaving the rest untouched. */
export function clearStaffFilterChip(
  state: StaffFilterState,
  id: StaffFilterChipKey,
): StaffFilterState {
  switch (id) {
    case "search":
      return { ...state, q: "" };
    case "role":
      return { ...state, role: "all" };
    case "portal":
      return { ...state, portal: "all" };
    default:
      return state;
  }
}

/**
 * Client-side directory filtering — identical semantics to the previous
 * inline implementation: name-only search across display and legal name.
 */
export function filterStaffList(list: Staff[], state: StaffFilterState): Staff[] {
  const q = state.q.toLowerCase();
  return list.filter((s) => {
    if (state.role !== "all" && s.role !== state.role) return false;
    if (state.portal !== "all" && staffPortalStatusOf(s) !== state.portal) return false;
    if (
      state.q &&
      !displayStaff(s).toLowerCase().includes(q) &&
      !s.legalName.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function staffResultCountLabel(shown: number, total: number): string {
  return `Showing ${shown} of ${total} staff`;
}

/** Distinct roles present in the directory, used for the live role filter. */
export function staffRoleOptions(list: Staff[]): string[] {
  return Array.from(new Set(list.map((s) => s.role).filter(Boolean))).sort() as string[];
}

/** Contact column content: email primary, phone secondary, no filler punctuation. */
export function staffContactLines(s: Pick<Staff, "email" | "phone">): {
  primary: string | null;
  secondary: string | null;
} {
  const email = s.email?.trim() ? s.email.trim() : null;
  const phone = s.phone?.trim() ? s.phone.trim() : null;
  if (email) return { primary: email, secondary: phone };
  if (phone) return { primary: phone, secondary: null };
  return { primary: null, secondary: null };
}
