import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin } from "lucide-react";
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
  const location = [centre.address, centre.city].filter(Boolean).join(", ");

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-primary/40">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
              {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
            </p>
          </div>
          <CarerShiftStatusBadge status={shift.status} size="sm" />
        </div>

        <div className="space-y-1 border-t border-border/60 pt-3">
          <p className="text-sm font-medium text-foreground">{centre.name}</p>
          {location ? (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{location}</span>
            </p>
          ) : null}
          {shift.roleNeeded ? (
            <p className="text-sm text-muted-foreground">{shift.roleNeeded}</p>
          ) : null}
        </div>

        <Link
          to="/carer/shifts/$id"
          params={{ id: shift.id }}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          aria-label={carerShiftDetailLinkLabel(shift)}
        >
          View details
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
