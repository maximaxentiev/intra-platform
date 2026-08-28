import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { CarerAvailabilityPreviewCard } from "@/components/carer/CarerAvailabilityPreviewCard";
import { useCarerUpcomingAvailability } from "@/lib/carer-availability-upcoming";

const PREVIEW_LIMIT = 3;

export function CarerAvailabilityDashboardSummary() {
  const { data, isLoading, isError } = useCarerUpcomingAvailability(1, 10);
  const previewItems = data?.items.slice(0, PREVIEW_LIMIT) ?? [];
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
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Could not load upcoming availability.</p>
        <Link
          to="/carer/availability"
          className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
        >
          Edit availability
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasUpcoming ? (
        <>
          <p className="rounded-xl border border-border bg-card p-4 text-base font-medium text-foreground">
            No upcoming availability added.
          </p>
          <Link
            to="/carer/availability"
            className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
          >
            Edit availability
          </Link>
        </>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previewItems.map((item) => (
              <li key={item.calendarDate}>
                <CarerAvailabilityPreviewCard calendarDate={item.calendarDate} windows={item.windows} />
              </li>
            ))}
          </ul>
          <Link
            to="/carer/availability"
            className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
          >
            Edit availability
          </Link>
        </>
      )}
    </div>
  );
}
