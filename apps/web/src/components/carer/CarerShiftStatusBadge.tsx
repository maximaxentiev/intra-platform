import { StatusBadge } from "@/components/StatusBadge";
import {
  carerShiftStatusLabel,
  CARER_SHIFT_STATUS_TONE,
} from "@/lib/carer-shifts-display";
import type { CarerShiftStatus } from "@/lib/carer-shifts";

type CarerShiftStatusBadgeProps = {
  status: CarerShiftStatus;
  size?: "xs" | "sm" | "md";
};

export function CarerShiftStatusBadge({ status, size = "sm" }: CarerShiftStatusBadgeProps) {
  return (
    <StatusBadge status={CARER_SHIFT_STATUS_TONE[status]} size={size}>
      {carerShiftStatusLabel(status)}
    </StatusBadge>
  );
}
