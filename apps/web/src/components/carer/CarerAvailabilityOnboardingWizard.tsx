import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  async function handleCompleteAvailabilityStep() {
    setFinishError(null);
    setFinishing(true);
    try {
      await carerAvailabilityApi.completeOnboardingStep();
      onComplete();
    } catch (err) {
      await refreshOnboardingState();
      const message = mapAvailabilityApiError(err, "Could not complete your availability step.");
      setFinishError(message);
      toast.error(message);
    } finally {
      setFinishing(false);
    }
  }

  const busy = mutations.saving || mutations.removing || finishing;
  const anchorReady = onboardingState.anchorEstablished;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Share an initial two-week snapshot of when you might be available to work. You can leave
          days blank — this step is optional and does not require availability on every day.
        </p>
        <p className="text-sm text-muted-foreground">Your changes are saved automatically.</p>
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">Week {activeWeek} of 2</p>
        <p className="text-sm text-muted-foreground">{formatWeekRangeLabel(weekStart)}</p>
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
            onAdd={() => mutations.openAdd(day.dayOfWeek, day.calendarDate)}
            onEdit={(slot) => mutations.openEdit(slot, day.calendarDate)}
            onRemove={(slot) => mutations.setRemovingSlot(slot)}
          />
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        {activeWeek === 1 ? (
          <Button
            type="button"
            className="h-11 w-full"
            disabled={!anchorReady || busy}
            onClick={() => setWizardWeek(2)}
          >
            Next week
          </Button>
        ) : (
          <>
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
                disabled={!anchorReady || busy}
                onClick={() => void handleCompleteAvailabilityStep()}
              >
                {finishing ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Completing step...
                  </>
                ) : (
                  "Complete availability step"
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
};

function OnboardingDayCard({
  day,
  today,
  busy,
  onAdd,
  onEdit,
  onRemove,
}: OnboardingDayCardProps) {
  const dayName = CARER_DAY_NAMES[day.dayOfWeek] ?? "Day";
  const todayDay = isTodayCalendarDate(day.calendarDate, today);
  const hasWindows = day.windows.length > 0;

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
        <p className="text-sm text-muted-foreground">Past date</p>
      </section>
    );
  }

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
        </div>
        <CarerAvailabilityAddButton onClick={onAdd} disabled={busy} />
      </div>

      {hasWindows ? (
        <CarerAvailabilityWindowList
          slots={day.windows}
          dayName={dayName}
          allowEdit
          allowRemove
          busy={busy}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No availability added yet.</p>
      )}
    </section>
  );
}

export function CarerAvailabilityOnboardingWizardSkeleton() {
  return <CarerAvailabilityLoadingCard />;
}
