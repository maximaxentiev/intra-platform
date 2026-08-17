import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { useCarerUpcomingAvailability } from "@/lib/carer-availability-upcoming";

export function CarerAvailabilityDashboardSummary() {
  const { data, isLoading, isError } = useCarerUpcomingAvailability(1, 10);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading availability…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load upcoming availability.{" "}
        <Link to="/carer/availability" className="font-medium text-primary hover:underline">
          Manage availability
        </Link>
      </p>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">No upcoming availability added.</p>
        <Link to="/carer/availability" className="font-medium text-primary hover:underline">
          Add availability
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-3">
        {data.items.map((item) => (
          <li key={item.calendarDate}>
            <p className="font-medium">{formatDashboardAvailabilityDateLabel(item.calendarDate)}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {item.windows.map((window) => (
                <li key={window.id}>
                  {formatAvailabilityWindowDisplay(window.startTime, window.endTime)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <Link
        to="/carer/availability"
        hash="upcoming-availability"
        className="font-medium text-primary hover:underline"
      >
        View more
      </Link>
    </div>
  );
}
