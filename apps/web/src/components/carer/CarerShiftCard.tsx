import { Link } from "@tanstack/react-router";
import { CarerShiftStatusBadge } from "@/components/carer/CarerShiftStatusBadge";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { carerShiftDetailLinkLabel } from "@/lib/carer-shifts-display";
import type { CarerShift } from "@/lib/carer-shifts";

type CarerShiftCardProps = {
  shift: CarerShift;
};

export function CarerShiftCard({ shift }: CarerShiftCardProps) {
  const { centre } = shift;

  return (
    <article className="rounded-md border bg-background p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold">
            {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
          </p>
          <CarerShiftStatusBadge status={shift.status} size="sm" />
        </div>

        <p className="text-sm font-medium">
          {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
        </p>

        <div className="space-y-0.5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{centre.name}</p>
          {centre.address ? <p className="break-words">{centre.address}</p> : null}
          {centre.city ? <p>{centre.city}</p> : null}
        </div>

        {shift.roleNeeded ? (
          <p className="text-sm font-medium text-foreground">{shift.roleNeeded}</p>
        ) : null}

        <Link
          to="/carer/shifts/$id"
          params={{ id: shift.id }}
          className="inline-block text-sm font-medium text-primary hover:underline"
          aria-label={carerShiftDetailLinkLabel(shift)}
        >
          View details
        </Link>
      </div>
    </article>
  );
}
