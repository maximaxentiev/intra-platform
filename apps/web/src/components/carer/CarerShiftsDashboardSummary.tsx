import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { useCarerShiftsSummary } from "@/lib/carer-shifts-queries";
import {
  carerShiftStatusLabel,
  CARER_SHIFT_STATUS_TONE,
} from "@/lib/carer-shifts-display";

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
                <StatusBadge status={CARER_SHIFT_STATUS_TONE[shift.status]} size="xs">
                  {carerShiftStatusLabel(shift.status)}
                </StatusBadge>
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
