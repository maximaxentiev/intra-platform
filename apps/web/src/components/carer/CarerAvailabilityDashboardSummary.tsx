import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { useCarerUpcomingAvailability } from "@/lib/carer-availability-upcoming";

export function CarerAvailabilityDashboardSummary() {
  const { data, isLoading, isError } = useCarerUpcomingAvailability(1, 10);
  const previewItems = data?.items.slice(0, 4) ?? [];
  const hasUpcoming = previewItems.length > 0;

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
      <div className="space-y-2 text-sm">
        <Link to="/carer/availability" className="font-medium text-primary hover:underline">
          Add availability
        </Link>
        <p className="text-muted-foreground">Could not load upcoming availability.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <Link to="/carer/availability" className="font-medium text-primary hover:underline">
        {hasUpcoming ? "Edit availability" : "Add availability"}
      </Link>

      {!hasUpcoming ? (
        <p className="text-muted-foreground">No upcoming availability added.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {previewItems.map((item) => (
              <li
                key={item.calendarDate}
                className="rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <p className="font-semibold text-foreground">
                  {formatDashboardAvailabilityDateLabel(item.calendarDate)}
                </p>
                <p className="text-muted-foreground">
                  {item.windows
                    .map((window) => formatAvailabilityWindowDisplay(window.startTime, window.endTime))
                    .join(", ")}
                </p>
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
        </>
      )}
    </div>
  );
}
