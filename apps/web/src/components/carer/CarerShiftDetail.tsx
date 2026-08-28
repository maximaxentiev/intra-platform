import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { CarerShiftStatusBadge } from "@/components/carer/CarerShiftStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  formatAvailabilityWindowDisplay,
  formatFullCalendarDateWithYearLabel,
} from "@/lib/carer-availability-dates";
import type { CarerShift } from "@/lib/carer-shifts";
import { carerShiftShowsStatusBadge } from "@/lib/carer-shifts-display";
import { useCarerShift } from "@/lib/carer-shifts-queries";

function CarerShiftDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite" aria-label="Loading shift details">
      <Skeleton className="h-6 w-28" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-full max-w-xs" />
        <Skeleton className="h-5 w-full max-w-sm" />
      </div>
    </div>
  );
}

function CarerShiftNotFound() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Shift not found</h1>
      <p className="text-sm text-muted-foreground">
        This shift is no longer available or is not assigned to your account.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link to="/carer/shifts">Back to shifts</Link>
      </Button>
    </div>
  );
}

function CarerShiftLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-foreground">Unable to load shift details.</p>
      <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

type CarerShiftDetailContentProps = {
  shift: CarerShift;
};

export function CarerShiftDetailContent({ shift }: CarerShiftDetailContentProps) {
  const { centre } = shift;
  const showStatus = carerShiftShowsStatusBadge(shift.status);
  const location = [centre.address, centre.city].filter(Boolean).join(", ");
  const centreNotes = centre.notes?.trim() ?? "";

  return (
    <article className="mx-auto w-full max-w-lg space-y-6">
      {showStatus ? (
        <div className="space-y-2">
          <CarerShiftStatusBadge status={shift.status} />
          {shift.status === "cancelled" ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Shift cancelled</p>
              <p className="text-sm text-muted-foreground">This shift has been cancelled.</p>
              {shift.cancellationReason ? (
                <p className="break-words text-sm text-foreground">
                  <span className="text-muted-foreground">Reason: </span>
                  {shift.cancellationReason}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{centre.name}</h2>
        <p className="text-base font-medium text-foreground">
          {formatFullCalendarDateWithYearLabel(shift.shiftDate)}
        </p>
        <p className="text-base tabular-nums text-foreground">
          {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
        </p>
      </div>

      {location ? (
        <div className="flex items-start gap-2 text-sm text-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 break-words">{location}</p>
        </div>
      ) : null}

      <section aria-labelledby="centre-rules-heading" className="rounded-xl border border-border bg-card p-4">
        <h3 id="centre-rules-heading" className="text-base font-semibold text-foreground">
          Centre rules and notes
        </h3>
        {centreNotes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{centreNotes}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No additional rules or notes.</p>
        )}
      </section>
    </article>
  );
}

type CarerShiftDetailProps = {
  shiftId: string;
};

export function CarerShiftDetail({ shiftId }: CarerShiftDetailProps) {
  const { data, isLoading, isError, error, refetch } = useCarerShift(shiftId);

  if (isLoading) {
    return <CarerShiftDetailSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <CarerShiftNotFound />;
    }
    return <CarerShiftLoadError onRetry={() => void refetch()} />;
  }

  if (!data) {
    return <CarerShiftLoadError onRetry={() => void refetch()} />;
  }

  return <CarerShiftDetailContent shift={data} />;
}

export function CarerShiftDetailBackLink() {
  return (
    <Button asChild variant="outline" className="h-11 min-h-11 gap-1.5 px-4 font-medium">
      <Link to="/carer/shifts">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to shifts
      </Link>
    </Button>
  );
}
