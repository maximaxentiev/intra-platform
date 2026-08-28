import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
      className={cn(
        "group block rounded-xl border border-border bg-card shadow-xs transition-colors",
        "hover:border-primary/40 hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* Desktop: fixed-column row */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-0">
        <div className="flex min-h-[4.5rem] items-center border-r border-border px-4 py-3">
          <div className="min-w-0 space-y-1">
            <p className="line-clamp-2 font-bold text-foreground">{shift.centre.name}</p>
            {showStatus ? <CarerShiftStatusBadge status={shift.status} size="sm" /> : null}
          </div>
        </div>
        <div className="flex min-h-[4.5rem] items-center border-r border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
          </p>
        </div>
        <div className="flex min-h-[4.5rem] items-center border-r border-border px-4 py-3">
          <p className="text-sm font-medium tabular-nums text-foreground">
            {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
          </p>
        </div>
        <div className="flex min-h-[4.5rem] items-center gap-1 px-4 py-3 text-sm font-semibold text-primary">
          View shift
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>

      {/* Mobile: stacked card */}
      <div className="space-y-3 p-4 md:hidden">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centre</p>
          <p className="line-clamp-2 text-base font-bold text-foreground">{shift.centre.name}</p>
          {showStatus ? <CarerShiftStatusBadge status={shift.status} size="sm" /> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
          <p className="mt-1 text-base font-medium text-foreground">
            {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
          <p className="mt-1 text-base font-medium tabular-nums text-foreground">
            {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
          </p>
        </div>
        <p className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary">
          View shift
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </p>
      </div>
    </Link>
  );
}
