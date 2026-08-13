import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addDaysToDateString,
  calendarDateFromWeekDay,
  CARER_DAY_NAMES,
  currentMondayWeekStart,
  formatShortCalendarDate,
  formatWeekRangeLabel,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import { groupSlotsByDay, type CarerAvailabilitySlot } from "@/lib/carer-availability";
import {
  CarerAvailabilityAddButton,
  CarerAvailabilityFormDialog,
  CarerAvailabilityLoadError,
  CarerAvailabilityLoadingCard,
  CarerAvailabilityRemoveDialog,
  CarerAvailabilityWindowList,
  useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";

type CarerAvailabilityEditorProps = {
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  slots: CarerAvailabilitySlot[] | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  loadFailed?: boolean;
  onRefresh: () => Promise<unknown> | void;
};

export function accountWeekChoices(today = torontoTodayDateString()) {
  const thisWeekStart = currentMondayWeekStart(today);
  return {
    thisWeekStart,
    nextWeekStart: addDaysToDateString(thisWeekStart, 7),
  };
}

export function CarerAvailabilityEditor({
  weekStart,
  onWeekStartChange,
  slots,
  isLoading,
  isFetching = false,
  loadFailed = false,
  onRefresh,
}: CarerAvailabilityEditorProps) {
  const { thisWeekStart, nextWeekStart } = accountWeekChoices();
  const weekChoice = weekStart === nextWeekStart ? "next" : "this";

  const grouped = useMemo(() => groupSlotsByDay(slots ?? []), [slots]);
  const weekHasSlots = (slots?.length ?? 0) > 0;

  const mutations = useCarerAvailabilitySlotMutations({
    weekStart,
    onAfterMutation: onRefresh,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Keep your availability up to date so our team knows when you&apos;re available to work.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatWeekRangeLabel(weekStart)}</p>
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Refreshing week…</p>
          ) : null}
        </div>
        <div
          className="inline-flex w-full rounded-md border p-1 sm:w-auto"
          role="group"
          aria-label="Choose week"
        >
          <Button
            type="button"
            variant={weekChoice === "this" ? "default" : "ghost"}
            size="sm"
            className="h-11 flex-1 sm:flex-none sm:px-4"
            onClick={() => onWeekStartChange(thisWeekStart)}
            disabled={isLoading || mutations.saving}
            aria-pressed={weekChoice === "this"}
          >
            This week
          </Button>
          <Button
            type="button"
            variant={weekChoice === "next" ? "default" : "ghost"}
            size="sm"
            className="h-11 flex-1 sm:flex-none sm:px-4"
            onClick={() => onWeekStartChange(nextWeekStart)}
            disabled={isLoading || mutations.saving}
            aria-pressed={weekChoice === "next"}
          >
            Next week
          </Button>
        </div>
      </div>

      {loadFailed ? <CarerAvailabilityLoadError onRetry={() => void onRefresh()} /> : null}

      {isLoading ? (
        <CarerAvailabilityLoadingCard />
      ) : (
        <>
          {!weekHasSlots ? (
            <Card>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium">You haven&apos;t added availability for this week yet.</p>
                <p className="text-muted-foreground">Add the times you&apos;re available to work.</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-3">
            {CARER_DAY_NAMES.map((dayName, dayOfWeek) => {
              const calendarDate = calendarDateFromWeekDay(weekStart, dayOfWeek);
              const past = mutations.dayHelpers.isPast(calendarDate);
              const todayDay = mutations.dayHelpers.isToday(calendarDate);
              const daySlots = grouped.get(dayOfWeek) ?? [];

              return (
                <section
                  key={dayOfWeek}
                  aria-labelledby={`carer-day-${dayOfWeek}`}
                  className={
                    past
                      ? "rounded-lg border bg-muted/30 p-4 opacity-80"
                      : todayDay
                        ? "rounded-lg border border-primary/30 bg-primary/5 p-4"
                        : "rounded-lg border bg-card p-4"
                  }
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 id={`carer-day-${dayOfWeek}`} className="text-base font-semibold">
                        {dayName}
                        {todayDay ? (
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Today
                          </span>
                        ) : null}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatShortCalendarDate(calendarDate)}
                      </p>
                    </div>
                    {!past ? (
                      <CarerAvailabilityAddButton
                        onClick={() => mutations.openAdd(dayOfWeek, calendarDate)}
                        disabled={mutations.saving}
                      />
                    ) : null}
                  </div>

                  <CarerAvailabilityWindowList
                    slots={daySlots}
                    dayName={dayName}
                    allowEdit={!past}
                    allowRemove
                    busy={mutations.saving || mutations.removing}
                    onEdit={(slot) => mutations.openEdit(slot, calendarDate)}
                    onRemove={(slot) => mutations.setRemovingSlot(slot)}
                  />
                </section>
              );
            })}
          </div>
        </>
      )}

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
