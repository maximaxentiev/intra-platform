import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CARER_DAY_NAMES,
  formatShortCalendarDate,
  formatWeekRangeLabel,
  isTodayCalendarDate,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import {
  CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY,
  carerAvailabilityApi,
  countOnboardingWeekProgress,
  defaultOnboardingWizardWeek,
  mapAvailabilityApiError,
  type CarerGuidedAvailabilityOnboardingState,
  type CarerOnboardingAvailabilityDay,
} from "@/lib/carer-availability";
import {
  CarerAvailabilityAddButton,
  CarerAvailabilityFormDialog,
  CarerAvailabilityLoadError,
  CarerAvailabilityLoadingCard,
  CarerAvailabilityRemoveDialog,
  CarerAvailabilityWindowList,
  useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";

type WizardWeek = 1 | 2;

type CarerAvailabilityOnboardingWizardProps = {
  onboardingState: CarerGuidedAvailabilityOnboardingState;
  isFetching?: boolean;
  loadFailed?: boolean;
  onRefresh: () => Promise<unknown>;
  onComplete: () => void;
};

type PendingUnavailable = {
  weekStartDate: string;
  dayOfWeek: number;
  calendarDate: string;
  windowCount: number;
};

export function CarerAvailabilityOnboardingWizard({
  onboardingState,
  isFetching = false,
  loadFailed = false,
  onRefresh,
  onComplete,
}: CarerAvailabilityOnboardingWizardProps) {
  const queryClient = useQueryClient();
  const today = torontoTodayDateString();

  const [wizardWeek, setWizardWeek] = useState<WizardWeek | null>(null);
  const [pendingUnavailable, setPendingUnavailable] = useState<PendingUnavailable | null>(null);
  const [markingUnavailable, setMarkingUnavailable] = useState(false);
  const [clearingDay, setClearingDay] = useState<CarerOnboardingAvailabilityDay | null>(null);
  const [clearing, setClearing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    if (wizardWeek === null) {
      setWizardWeek(defaultOnboardingWizardWeek(onboardingState));
    }
  }, [onboardingState, wizardWeek]);

  const activeWeek = wizardWeek ?? defaultOnboardingWizardWeek(onboardingState);
  const weekStart =
    activeWeek === 1 ? onboardingState.week1Start! : onboardingState.week2Start!;
  const weekDays = useMemo(
    () => onboardingState.days.filter((d) => d.weekIndex === activeWeek),
    [onboardingState.days, activeWeek],
  );
  const weekProgress = countOnboardingWeekProgress(onboardingState.days, activeWeek);

  const refreshOnboardingState = async () => {
    await queryClient.invalidateQueries({
      queryKey: CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY,
    });
    await onRefresh();
  };

  const mutations = useCarerAvailabilitySlotMutations({
    weekStart,
    onAfterMutation: refreshOnboardingState,
  });

  async function handleMarkUnavailable(day: CarerOnboardingAvailabilityDay) {
    if (day.windows.length > 0) {
      setPendingUnavailable({
        weekStartDate: day.weekIndex === 1 ? onboardingState.week1Start! : onboardingState.week2Start!,
        dayOfWeek: day.dayOfWeek,
        calendarDate: day.calendarDate,
        windowCount: day.windows.length,
      });
      return;
    }
    await markUnavailable(day);
  }

  async function markUnavailable(day: CarerOnboardingAvailabilityDay) {
    const weekStartDate =
      day.weekIndex === 1 ? onboardingState.week1Start! : onboardingState.week2Start!;
    setMarkingUnavailable(true);
    try {
      await carerAvailabilityApi.markUnavailable({
        weekStartDate,
        dayOfWeek: day.dayOfWeek,
      });
      toast.success("Day marked as not available");
      await refreshOnboardingState();
    } catch (err) {
      toast.error(mapAvailabilityApiError(err, "Could not mark this day as not available."));
    } finally {
      setMarkingUnavailable(false);
      setPendingUnavailable(null);
    }
  }

  async function handleClearUnavailable(day: CarerOnboardingAvailabilityDay) {
    setClearing(true);
    try {
      const weekStartDate =
        day.weekIndex === 1 ? onboardingState.week1Start! : onboardingState.week2Start!;
      await carerAvailabilityApi.clearUnavailable({
        weekStartDate,
        dayOfWeek: day.dayOfWeek,
      });
      toast.success("Response cleared");
      setClearingDay(null);
      await refreshOnboardingState();
    } catch (err) {
      toast.error(mapAvailabilityApiError(err, "Could not clear this day's response."));
    } finally {
      setClearing(false);
    }
  }

  async function handleCompleteOnboarding() {
    setFinishError(null);
    setFinishing(true);
    try {
      await carerAvailabilityApi.completeStep3();
      onComplete();
    } catch (err) {
      await refreshOnboardingState();
      const message = mapAvailabilityApiError(err, "Could not finish onboarding.");
      setFinishError(message);
      toast.error(message);
    } finally {
      setFinishing(false);
    }
  }

  const busy = mutations.saving || mutations.removing || markingUnavailable || clearing || finishing;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Add your availability so our team knows when you&apos;re available to work.
        </p>
        <p className="text-sm text-muted-foreground">
          Complete the next two weeks by adding your availability or marking days you&apos;re not
          available.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">Week {activeWeek} of 2</p>
        <p className="text-sm text-muted-foreground">{formatWeekRangeLabel(weekStart)}</p>
        {weekProgress.required > 0 ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {weekProgress.answered} of {weekProgress.required} required days completed
          </p>
        ) : null}
        {isFetching && !loadFailed ? (
          <p className="text-xs text-muted-foreground">Refreshing…</p>
        ) : null}
      </div>

      {loadFailed ? <CarerAvailabilityLoadError onRetry={() => void onRefresh()} /> : null}

      <div className="space-y-3">
        {weekDays.map((day) => (
          <OnboardingDayCard
            key={day.calendarDate}
            day={day}
            today={today}
            busy={busy}
            onAdd={() =>
              mutations.openAdd(
                day.dayOfWeek,
                day.calendarDate,
              )
            }
            onEdit={(slot) => mutations.openEdit(slot, day.calendarDate)}
            onRemove={(slot) => mutations.setRemovingSlot(slot)}
            onMarkUnavailable={() => void handleMarkUnavailable(day)}
            onClearUnavailable={() => setClearingDay(day)}
          />
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        {activeWeek === 1 ? (
          <>
            {!onboardingState.week1Complete ? (
              <p className="text-sm text-muted-foreground">
                Add availability or mark each required day as not available before continuing.
              </p>
            ) : null}
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!onboardingState.week1Complete || busy}
              onClick={() => setWizardWeek(2)}
            >
              Next week
            </Button>
          </>
        ) : (
          <>
            {!onboardingState.canCompleteOnboarding ? (
              <p className="text-sm text-muted-foreground">
                Add availability or mark each required day as not available before finishing
                onboarding.
              </p>
            ) : null}
            {finishError ? (
              <p className="text-sm text-destructive" role="alert" aria-live="polite">
                {finishError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                disabled={busy}
                onClick={() => setWizardWeek(1)}
              >
                Previous week
              </Button>
              <Button
                type="button"
                className="h-11 w-full sm:flex-1"
                disabled={!onboardingState.canCompleteOnboarding || busy}
                onClick={() => void handleCompleteOnboarding()}
              >
                {finishing ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Completing onboarding...
                  </>
                ) : (
                  "Complete onboarding"
                )}
              </Button>
            </div>
          </>
        )}
      </div>

      <CarerAvailabilityFormDialog
        form={mutations.form}
        saving={mutations.saving}
        error={mutations.formError}
        onClose={() => mutations.setForm(null)}
        onChange={(patch) =>
          mutations.setForm((current) => (current ? { ...current, ...patch } : current))
        }
        onSave={() => void mutations.handleSaveForm()}
      />

      <CarerAvailabilityRemoveDialog
        slot={mutations.removingSlot}
        removing={mutations.removing}
        onClose={() => mutations.setRemovingSlot(null)}
        onConfirm={() => void mutations.handleRemoveConfirm()}
      />

      <AlertDialog
        open={pendingUnavailable !== null}
        onOpenChange={(open) => !open && setPendingUnavailable(null)}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this day as not available?</AlertDialogTitle>
            <AlertDialogDescription>
              Your saved availability for this day will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={markingUnavailable}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              disabled={markingUnavailable}
              onClick={() => {
                if (!pendingUnavailable) return;
                const day = weekDays.find(
                  (d) => d.calendarDate === pendingUnavailable.calendarDate,
                );
                if (day) void markUnavailable(day);
              }}
            >
              {markingUnavailable ? "Saving…" : "Mark not available"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearingDay !== null} onOpenChange={(open) => !open && setClearingDay(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Change this day&apos;s response?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your not available answer. You&apos;ll need to add availability or mark
              the day again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={clearing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              disabled={clearing}
              onClick={() => clearingDay && void handleClearUnavailable(clearingDay)}
            >
              {clearing ? "Clearing…" : "Clear response"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type OnboardingDayCardProps = {
  day: CarerOnboardingAvailabilityDay;
  today: string;
  busy: boolean;
  onAdd: () => void;
  onEdit: (slot: CarerOnboardingAvailabilityDay["windows"][number]) => void;
  onRemove: (slot: CarerOnboardingAvailabilityDay["windows"][number]) => void;
  onMarkUnavailable: () => void;
  onClearUnavailable: () => void;
};

function OnboardingDayCard({
  day,
  today,
  busy,
  onAdd,
  onEdit,
  onRemove,
  onMarkUnavailable,
  onClearUnavailable,
}: OnboardingDayCardProps) {
  const dayName = CARER_DAY_NAMES[day.dayOfWeek] ?? "Day";
  const todayDay = isTodayCalendarDate(day.calendarDate, today);

  if (day.status === "exempt_past") {
    return (
      <section
        aria-labelledby={`onboarding-day-${day.calendarDate}`}
        className="rounded-lg border bg-muted/30 p-4 opacity-80"
      >
        <div className="mb-2">
          <h3 id={`onboarding-day-${day.calendarDate}`} className="text-base font-semibold">
            {dayName}
          </h3>
          <p className="text-sm text-muted-foreground">{formatShortCalendarDate(day.calendarDate)}</p>
        </div>
        <p className="text-sm text-muted-foreground">No response required</p>
      </section>
    );
  }

  const statusLabel =
    day.status === "incomplete"
      ? "Needs a response"
      : day.status === "available"
        ? "Available"
        : "Not available";

  return (
    <section
      aria-labelledby={`onboarding-day-${day.calendarDate}`}
      className={
        todayDay
          ? "rounded-lg border border-primary/30 bg-primary/5 p-4"
          : "rounded-lg border bg-card p-4"
      }
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id={`onboarding-day-${day.calendarDate}`} className="text-base font-semibold">
            {dayName}
            {todayDay ? (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Today
              </span>
            ) : null}
          </h3>
          <p className="text-sm text-muted-foreground">{formatShortCalendarDate(day.calendarDate)}</p>
          <p className="mt-1 text-sm font-medium" aria-live="polite">
            {statusLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {day.status !== "unavailable" ? (
            <CarerAvailabilityAddButton onClick={onAdd} disabled={busy} />
          ) : null}
          {day.status === "incomplete" || day.status === "available" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11"
              disabled={busy}
              onClick={onMarkUnavailable}
            >
              Not available
            </Button>
          ) : null}
          {day.status === "unavailable" ? (
            <>
              <CarerAvailabilityAddButton onClick={onAdd} disabled={busy} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                disabled={busy}
                onClick={onClearUnavailable}
              >
                Change response
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {day.status === "available" ? (
        <CarerAvailabilityWindowList
          slots={day.windows}
          dayName={dayName}
          allowEdit
          allowRemove
          busy={busy}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ) : day.status === "incomplete" ? (
        <p className="text-sm text-muted-foreground">
          Add your availability or mark this day as not available.
        </p>
      ) : day.status === "unavailable" ? (
        <p className="text-sm font-medium">Not available</p>
      ) : null}
    </section>
  );
}

export function CarerAvailabilityOnboardingWizardSkeleton() {
  return <CarerAvailabilityLoadingCard />;
}
