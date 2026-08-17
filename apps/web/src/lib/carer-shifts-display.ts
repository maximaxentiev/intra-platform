import type { CarerShiftStatus } from "@/lib/carer-shifts";

export const CARER_SHIFT_STATUS_LABEL: Record<CarerShiftStatus, string> = {
  upcoming: "Upcoming",
  today: "Today",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Maps Carer shift status to StatusBadge tone keys. */
export const CARER_SHIFT_STATUS_TONE: Record<
  CarerShiftStatus,
  "filled" | "pending" | "completed" | "cancelled"
> = {
  upcoming: "filled",
  today: "pending",
  completed: "completed",
  cancelled: "cancelled",
};

export function carerShiftStatusLabel(status: CarerShiftStatus): string {
  return CARER_SHIFT_STATUS_LABEL[status];
}

export function carerShiftsRangeLabel(
  data: { page: number; pageSize: number; totalItems: number } | undefined,
): string | null {
  if (!data || data.totalItems === 0) return null;
  const start = (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.totalItems);
  return `Showing ${start}–${end} of ${data.totalItems} shifts`;
}
