import { Link } from "@tanstack/react-router";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { carerShiftDetailLinkLabel } from "@/lib/carer-shifts-display";
import type { CarerShift } from "@/lib/carer-shifts";
import { cn } from "@/lib/utils";

type CarerShiftPreviewCardProps = {
  shift: CarerShift;
  className?: string;
};

export function CarerShiftPreviewCard({ shift, className }: CarerShiftPreviewCardProps) {
  return (
    <Link
      to="/carer/shifts/$id"
      params={{ id: shift.id }}
      aria-label={carerShiftDetailLinkLabel(shift)}
      className={cn(
        "group flex min-h-[8.5rem] flex-col rounded-xl border border-border bg-card p-4 text-foreground shadow-xs transition-colors duration-200",
        "hover:border-primary hover:bg-primary hover:text-primary-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <p className="line-clamp-2 text-base font-bold leading-snug group-hover:text-primary-foreground">
        {shift.centre.name}
      </p>
      <div
        aria-hidden="true"
        className="my-3 h-px bg-border group-hover:bg-primary-foreground/30"
      />
      <p className="text-sm font-medium group-hover:text-primary-foreground">
        {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
      </p>
      <div
        aria-hidden="true"
        className="my-2 h-px bg-border group-hover:bg-primary-foreground/30"
      />
      <p className="text-sm font-medium tabular-nums group-hover:text-primary-foreground">
        {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
      </p>
    </Link>
  );
}

export function CarerShiftPreviewEmptyCard() {
  return (
    <div
      className="flex min-h-[8.5rem] items-center justify-center rounded-xl border border-border bg-card p-6 text-center shadow-xs"
      role="status"
    >
      <p className="text-base font-medium text-foreground">
        There are no upcoming shifts right now
      </p>
    </div>
  );
}
