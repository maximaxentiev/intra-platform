import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarerShiftStatusBadge } from "@/components/carer/CarerShiftStatusBadge";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { useCarerShiftsSummary } from "@/lib/carer-shifts-queries";
import { carerShiftDetailLinkLabel } from "@/lib/carer-shifts-display";

export function CarerShiftsDashboardSummary() {
  const { data, isLoading, isError, refetch } = useCarerShiftsSummary(3);
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading upcoming shifts…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">Unable to load upcoming shifts.</p>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 font-medium"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
        <div>
          <Link to="/carer/shifts" className="font-medium text-primary hover:underline">
            View all shifts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {items.length === 0 ? (
        <p className="text-muted-foreground">No upcoming shifts assigned.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((shift) => (
            <li key={shift.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {formatDashboardAvailabilityDateLabel(shift.shiftDate)}
                </p>
                <CarerShiftStatusBadge status={shift.status} size="xs" />
              </div>
              <p className="text-muted-foreground">
                {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
              </p>
              <p className="font-medium">{shift.centre.name}</p>
              {shift.centre.city ? (
                <p className="text-muted-foreground">{shift.centre.city}</p>
              ) : null}
              {shift.roleNeeded ? (
                <p className="text-muted-foreground">{shift.roleNeeded}</p>
              ) : null}
              <Link
                to="/carer/shifts/$id"
                params={{ id: shift.id }}
                className="inline-block font-medium text-primary hover:underline"
                aria-label={carerShiftDetailLinkLabel(shift)}
              >
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/carer/shifts" className="font-medium text-primary hover:underline">
        View all shifts
      </Link>
    </div>
  );
}
