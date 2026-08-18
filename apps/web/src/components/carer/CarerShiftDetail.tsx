import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CarerShiftStatusBadge } from "@/components/carer/CarerShiftStatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  formatAvailabilityWindowDisplay,
  formatFullCalendarDateWithYearLabel,
} from "@/lib/carer-availability-dates";
import {
  isCarerCancellationEligible,
  useCancelCarerShift,
} from "@/lib/carer-shift-cancellation";
import type { CarerShift } from "@/lib/carer-shifts";
import { useCarerShift } from "@/lib/carer-shifts-queries";

function CarerShiftDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite" aria-label="Loading shift details">
      <Skeleton className="h-6 w-28" />
      <div className="space-y-4 rounded-md border bg-background p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-full max-w-xs" />
        <Skeleton className="h-5 w-full max-w-sm" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  );
}

function CarerShiftNotFound() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 rounded-md border bg-background p-4 sm:p-6">
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
    <div className="mx-auto w-full max-w-lg space-y-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
      <p className="text-sm text-foreground">Unable to load shift details.</p>
      <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function CarerShiftCancellationSection({ shift }: { shift: CarerShift }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useCancelCarerShift(shift.id);

  if (!isCarerCancellationEligible(shift)) {
    return null;
  }

  async function handleCancel() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Please enter a reason for cancellation.");
      return;
    }
    try {
      await cancel.mutateAsync(trimmed);
      setOpen(false);
      setReason("");
      toast.success("Shift cancelled", {
        description: "This shift has been cancelled.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel shift.");
    }
  }

  return (
    <section className="space-y-3 border-t pt-5">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            Cancel shift
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelling this shift will immediately remove it from your upcoming work. The Intra
              operations team will be notified of the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Reason for cancellation</Label>
            <Textarea
              id="cancellation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please tell us why you need to cancel this shift."
              rows={4}
              maxLength={1000}
              className="min-h-[6rem] resize-y"
              disabled={cancel.isPending}
            />
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col-reverse">
            <AlertDialogCancel className="h-11 w-full" disabled={cancel.isPending}>
              Keep shift
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full"
              disabled={cancel.isPending}
              onClick={() => void handleCancel()}
            >
              {cancel.isPending ? "Cancelling…" : "Cancel shift"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type CarerShiftDetailContentProps = {
  shift: CarerShift;
};

export function CarerShiftDetailContent({ shift }: CarerShiftDetailContentProps) {
  const { centre } = shift;

  return (
    <article className="mx-auto w-full max-w-lg space-y-6 rounded-md border bg-background p-4 sm:p-6">
      <div className="space-y-3">
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

      <dl className="space-y-5 text-sm">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="text-lg font-semibold text-foreground">
            {formatFullCalendarDateWithYearLabel(shift.shiftDate)}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Time</dt>
          <dd className="text-lg font-semibold text-foreground">
            {formatAvailabilityWindowDisplay(shift.startTime, shift.endTime)}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Centre</dt>
          <dd className="space-y-0.5">
            <p className="font-medium text-foreground">{centre.name}</p>
            {centre.address ? <p className="break-words text-foreground">{centre.address}</p> : null}
            {centre.city ? <p className="text-foreground">{centre.city}</p> : null}
          </dd>
        </div>

        {shift.roleNeeded ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-foreground">{shift.roleNeeded}</dd>
          </div>
        ) : null}
      </dl>

      <CarerShiftCancellationSection shift={shift} />
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
    <Button asChild variant="ghost" className="h-11 min-h-11 px-0 text-muted-foreground hover:text-foreground">
      <Link to="/carer/shifts">
        <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
        Back to shifts
      </Link>
    </Button>
  );
}
