import type { AvailableStaff } from "@/lib/db";

/** Render the Ops priority line from authoritative API matching metadata. */
export function formatAvailableStaffPriorityLine(staff: AvailableStaff): string {
  return `Priority ${staff.matchingPriority.group} · ${staff.matchingPriority.label}`;
}

/** True when two adjacent available-staff rows belong to different priority groups. */
export function isAvailableStaffPriorityBoundary(
  previous: AvailableStaff | undefined,
  current: AvailableStaff,
): boolean {
  return previous != null && previous.matchingPriority.group !== current.matchingPriority.group;
}
