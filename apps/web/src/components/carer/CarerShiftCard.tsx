import { Link } from "@tanstack/react-router";
import { CarerShiftStatusBadge } from "@/components/carer/CarerShiftStatusBadge";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import {
  carerShiftDetailLinkLabel,
  carerShiftShowsStatusBadge,
} from "@/lib/carer-shifts-display";
import type { CarerShift } from "@/lib/carer-shifts";

type CarerShiftCardProps = {
  shift: CarerShift;
};

export function CarerShiftCard({ shift }: CarerShiftCardProps) {
  const showStatus = carerShiftShowsStatusBadge(shift.status);

  return (
    <Link
      to="/carer/shifts/$id"
      params={{ id: shift.id }}
      aria-label={carerShiftDetailLinkLabel(shift)}
      className="block rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-semibold text-foreground">{shift.centre.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDashboardAvailabilityDateLabel(shift.shiftDate)} ·{" "}
            {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
          </p>
        </div>
        {showStatus ? <CarerShiftStatusBadge status={shift.status} size="sm" /> : null}
      </div>
    </Link>
  );
}
