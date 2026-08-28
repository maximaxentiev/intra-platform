import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CarerShiftPreviewCard,
  CarerShiftPreviewEmptyCard,
} from "@/components/carer/CarerShiftPreviewCard";
import { useCarerShiftsSummary } from "@/lib/carer-shifts-queries";

const HOME_PREVIEW_LIMIT = 4;
const SUMMARY_FETCH_LIMIT = 5;

export function CarerShiftsDashboardSummary() {
  const { data, isLoading, isError, refetch } = useCarerShiftsSummary(SUMMARY_FETCH_LIMIT);
  const allItems = data?.items ?? [];
  const items = allItems.slice(0, HOME_PREVIEW_LIMIT);
  const hasMoreShifts = allItems.length > HOME_PREVIEW_LIMIT;

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
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Unable to load upcoming shifts.</p>
        <Button type="button" variant="outline" className="h-11" onClick={() => void refetch()}>
          Retry
        </Button>
        <div>
          <Link
            to="/carer/shifts"
            className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
          >
            View more shifts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <CarerShiftPreviewEmptyCard />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((shift) => (
            <li key={shift.id}>
              <CarerShiftPreviewCard shift={shift} className="h-full" />
            </li>
          ))}
        </ul>
      )}

      {hasMoreShifts ? (
        <Link
          to="/carer/shifts"
          className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
        >
          View more shifts
        </Link>
      ) : null}
    </div>
  );
}
