import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { useCarerShiftsSummary } from "@/lib/carer-shifts-queries";
import { carerShiftDetailLinkLabel } from "@/lib/carer-shifts-display";

export function CarerShiftsDashboardSummary() {
  const { data, isLoading, isError, refetch } = useCarerShiftsSummary(4);
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
            View more shifts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {items.length === 0 ? (
        <p className="text-muted-foreground">No upcoming shifts assigned.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((shift) => (
            <li key={shift.id}>
              <Link
                to="/carer/shifts/$id"
                params={{ id: shift.id }}
                aria-label={carerShiftDetailLinkLabel(shift)}
                className="block rounded-lg border border-border/70 bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <p className="truncate font-semibold text-foreground">{shift.centre.name}</p>
                <p className="truncate text-muted-foreground">
                  {formatDashboardAvailabilityDateLabel(shift.shiftDate)} ·{" "}
                  {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/carer/shifts" className="inline-block pt-1 font-medium text-primary hover:underline">
        View more shifts
      </Link>
    </div>
  );
}
