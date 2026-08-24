import {
  CENTRE_CHANNEL_OPTIONS,
  channelLabel,
  displayStaff,
  type CentreChannel,
  type CentreContact,
  type CentreListItem,
  type ShiftStatus,
} from "@/lib/db";
import { shiftAssigneeLabel } from "@/lib/shifts-list-ui";

/**
 * Presentation helpers for the Ops Centres experience.
 *
 * Pure display + client-side name filtering. These mirror the existing
 * behaviour exactly — no new business rules, no derived operational state.
 */

/** Quiet fallback used across Centre read presentation. */
export const CENTRE_EMPTY = "—";

/** Live, client-side, NAME-ONLY search. Matches the existing list behaviour. */
export function filterCentresByName<T extends { name: string }>(list: T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((c) => c.name.toLowerCase().includes(needle));
}

export function centreResultCountLabel(shown: number, total: number): string {
  return `Showing ${shown} of ${total} centres`;
}

/**
 * Combines address + city into one readable location.
 * The city is omitted when the address already mentions it.
 */
export function centreLocationLabel(
  address: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const a = (address ?? "").trim();
  const c = (city ?? "").trim();
  if (!a && !c) return null;
  if (!a) return c;
  if (!c) return a;
  const mentionsCity = a.toLowerCase().includes(c.toLowerCase());
  return mentionsCity ? a : `${a}, ${c}`;
}

export function centreLocationOrFallback(
  address: string | null | undefined,
  city: string | null | undefined,
  fallback = "No location on file",
): string {
  return centreLocationLabel(address, city) ?? fallback;
}

export function centrePrimaryContactLabel(centre: Pick<CentreListItem, "primaryContactName">): string {
  const name = (centre.primaryContactName ?? "").trim();
  return name || "No primary contact";
}

/** Compact readable list of secondary channels, or "None". */
export function secondaryChannelsLabel(channels: CentreChannel[] | undefined | null): string {
  const list = (channels ?? []).filter((c) =>
    CENTRE_CHANNEL_OPTIONS.some((o) => o.value === c),
  );
  if (list.length === 0) return "None";
  return list.map((c) => channelLabel(c)).join(", ");
}

/** Secondary channels can never duplicate the primary channel. */
export function withoutPrimaryChannel(
  secondary: CentreChannel[],
  primary: CentreChannel,
): CentreChannel[] {
  return secondary.filter((c) => c !== primary);
}

/**
 * Primary contact is positional only — the first contact in the ordered
 * response. There is no `isPrimary` field and none is invented here.
 */
export function isPrimaryContact(index: number): boolean {
  return index === 0;
}

export function contactDisplayName(contact: Pick<CentreContact, "name">): string {
  return (contact.name ?? "").trim() || "Unnamed contact";
}

/** Non-empty contact detail lines (email / phone) for compact read rows. */
export function contactDetailLines(
  contact: Pick<CentreContact, "email" | "phone">,
): string[] {
  return [contact.email, contact.phone].map((v) => (v ?? "").trim()).filter(Boolean);
}

export type ContactDraftFields = Pick<CentreContact, "name" | "title" | "email" | "phone">;

/** New contacts require at least one meaningful field before POST. */
export function contactDraftHasContent(draft: ContactDraftFields): boolean {
  return [draft.name, draft.title, draft.email, draft.phone].some((v) => (v ?? "").trim() !== "");
}

/** Reorder produces the FULL ordered id array expected by the API. */
export function reorderedContactIds(
  contacts: Array<Pick<CentreContact, "id">>,
  index: number,
  direction: -1 | 1,
): string[] | null {
  const list = [...contacts];
  const target = index + direction;
  if (target < 0 || target >= list.length) return null;
  [list[index], list[target]] = [list[target], list[index]];
  return list.map((c) => c.id);
}

/** Assigned staff label for the Centre shifts tab. */
export function centreShiftAssignedLabel(shift: {
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
  status: ShiftStatus;
}): string {
  const assignedName =
    shift.assignedStaffId && shift.assignedLegalName
      ? displayStaff({
          legalName: shift.assignedLegalName,
          displayName: shift.assignedDisplayName ?? "",
          useDisplayName: shift.assignedUseDisplayName ?? false,
        })
      : null;
  return shiftAssigneeLabel(assignedName, shift.status).text;
}
