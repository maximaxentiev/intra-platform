import type { ShiftStatus } from "@/lib/db";

export function isShiftHistorical(status: ShiftStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/** Same lifecycle edit rules as the individual Shift detail route. */
export function canEditShiftFields(status: ShiftStatus): boolean {
  return status === "pending" || status === "filled";
}

export function shouldLoadAvailableStaff(
  status: ShiftStatus,
  assignedStaffId: string | null | undefined,
): boolean {
  return status === "pending" && !assignedStaffId;
}

export function showAssignedCarerSection(
  status: ShiftStatus,
  assignedStaffId: string | null | undefined,
): boolean {
  return Boolean(assignedStaffId) && (status === "filled" || status === "completed");
}
