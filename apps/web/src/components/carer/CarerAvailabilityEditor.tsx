import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addDaysToDateString,
  calendarDateFromWeekDay,
  CARER_DAY_NAMES,
  currentMondayWeekStart,
  formatAvailabilityWindowDisplay,
  formatShortCalendarDate,
  formatWeekRangeLabel,
  isPastCalendarDate,
  isTodayCalendarDate,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import {
  carerAvailabilityApi,
  groupSlotsByDay,
  mapAvailabilityApiError,
  validateClientTimeRange,
  type CarerAvailabilitySlot,
} from "@/lib/carer-availability";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

type EditorMode = "onboarding" | "account";

type CarerAvailabilityEditorProps = {
  mode: EditorMode;
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  slots: CarerAvailabilitySlot[] | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  loadFailed?: boolean;
  onRefresh: () => Promise<unknown> | void;
  onStepComplete?: () => void;
};

type FormState = {
  kind: "add" | "edit";
  dayOfWeek: number;
  slotId?: string;
  startTime: string;
  endTime: string;
};

export function CarerAvailabilityEditor({
  mode,
  weekStart,
  onWeekStartChange,
  slots,
  isLoading,
  isFetching = false,
  loadFailed = false,
  onRefresh,
  onStepComplete,
}: CarerAvailabilityEditorProps) {
  const queryClient = useQueryClient();
  const today = torontoTodayDateString();
  const thisWeekStart = currentMondayWeekStart(today);

  const grouped = useMemo(() => groupSlotsByDay(slots ?? []), [slots]);
  const weekHasSlots = (slots?.length ?? 0) > 0;

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingSlot, setRemovingSlot] = useState<CarerAvailabilitySlot | null>(null);
  const [removing, setRemoving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  async function invalidateWeek() {
    await queryClient.invalidateQueries({ queryKey: ["carer-availability", weekStart] });
    await onRefresh();
  }

  function openAdd(dayOfWeek: number) {
    setFormError(null);
    setForm({
      kind: "add",
      dayOfWeek,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
    });
  }

  function openEdit(slot: CarerAvailabilitySlot) {
    setFormError(null);
    setForm({
      kind: "edit",
      dayOfWeek: slot.dayOfWeek,
      slotId: slot.id,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
    });
  }

  async function handleSaveForm() {
    if (!form) return;
    setFormError(null);

    const validation = validateClientTimeRange(form.startTime, form.endTime);
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    try {
      if (form.kind === "add") {
        await carerAvailabilityApi.create({
          weekStartDate: weekStart,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
        });
        toast.success("Availability added");
      } else if (form.slotId) {
        await carerAvailabilityApi.update(form.slotId, {
          startTime: form.startTime,
          endTime: form.endTime,
        });
        toast.success("Availability updated");
      }
      setForm(null);
      await invalidateWeek();
    } catch (err) {
      const message = mapAvailabilityApiError(
        err,
        form.kind === "add" ? "Could not add availability." : "Could not update availability.",
      );
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveConfirm() {
    if (!removingSlot) return;
    setRemoving(true);
    try {
      await carerAvailabilityApi.remove(removingSlot.id);
      toast.success("Availability removed");
      setRemovingSlot(null);
      await invalidateWeek();
    } catch (err) {
      toast.error(mapAvailabilityApiError(err, "Could not remove availability."));
    } finally {
      setRemoving(false);
    }
  }

  async function handleFinishOnboarding() {
    setFinishError(null);
    setFinishing(true);
    try {
      await carerAvailabilityApi.completeStep3();
      onStepComplete?.();
    } catch (err) {
      const message = mapAvailabilityApiError(err, "Could not finish onboarding.");
      setFinishError(message);
      toast.error(message);
    } finally {
      setFinishing(false);
    }
  }

  const formDayLabel = form
    ? `${CARER_DAY_NAMES[form.dayOfWeek]} · ${formatShortCalendarDate(calendarDateFromWeekDay(weekStart, form.dayOfWeek))}`
    : "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {mode === "onboarding" ? (
        <p className="text-sm text-muted-foreground">
          Add your availability so our team knows when you&apos;re available to work. You can finish
          onboarding even if you don&apos;t add any times yet.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keep your availability up to date so our team knows when you&apos;re available to work.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatWeekRangeLabel(weekStart)}</p>
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Refreshing week…</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-[44px] flex-1 sm:flex-none"
            onClick={() => onWeekStartChange(addDaysToDateString(weekStart, -7))}
            disabled={isLoading || saving || finishing}
          >
            <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
            Previous week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-[44px] flex-1 sm:flex-none"
            onClick={() => onWeekStartChange(thisWeekStart)}
            disabled={isLoading || saving || finishing || weekStart === thisWeekStart}
          >
            This week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-[44px] flex-1 sm:flex-none"
            onClick={() => onWeekStartChange(addDaysToDateString(weekStart, 7))}
            disabled={isLoading || saving || finishing}
          >
            Next week
            <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {loadFailed ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>Could not load availability for this week.</p>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-destructive"
              onClick={() => void onRefresh()}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading availability…
          </CardContent>
        </Card>
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
              const past = isPastCalendarDate(calendarDate, today);
              const todayDay = isTodayCalendarDate(calendarDate, today);
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11"
                        onClick={() => openAdd(dayOfWeek)}
                        disabled={saving || finishing}
                      >
                        <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                        Add availability
                      </Button>
                    ) : null}
                  </div>

                  {daySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No availability added</p>
                  ) : (
                    <ul className="space-y-2">
                      {daySlots.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-medium">
                            {formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {!past ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-11"
                                onClick={() => openEdit(slot)}
                                disabled={saving || finishing}
                                aria-label={`Edit availability ${formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)} on ${dayName}`}
                              >
                                <Pencil aria-hidden="true" className="mr-1.5 h-4 w-4" />
                                Edit
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-11"
                              onClick={() => setRemovingSlot(slot)}
                              disabled={saving || finishing || removing}
                              aria-label={`Remove availability ${formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)} on ${dayName}`}
                            >
                              <Trash2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {mode === "onboarding" ? (
        <div className="space-y-2 border-t pt-4">
          {finishError ? (
            <p className="text-sm text-destructive" role="alert" aria-live="polite">
              {finishError}
            </p>
          ) : null}
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => void handleFinishOnboarding()}
            disabled={finishing || saving || isLoading}
          >
            {finishing ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Finishing…
              </>
            ) : (
              "Finish onboarding"
            )}
          </Button>
        </div>
      ) : null}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.kind === "add" ? "Add availability" : "Edit availability"}</DialogTitle>
            <DialogDescription>{formDayLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="carer-availability-start">Start time</Label>
              <Input
                id="carer-availability-start"
                type="time"
                className="h-11"
                value={form?.startTime ?? DEFAULT_START}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, startTime: e.target.value } : current))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carer-availability-end">End time</Label>
              <Input
                id="carer-availability-end"
                type="time"
                className="h-11"
                value={form?.endTime ?? DEFAULT_END}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, endTime: e.target.value } : current))
                }
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert" aria-live="polite">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" className="h-11" disabled={saving} onClick={() => void handleSaveForm()}>
              {saving ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : form?.kind === "add" ? (
                "Add availability"
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removingSlot !== null} onOpenChange={(open) => !open && setRemovingSlot(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this availability?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingSlot
                ? `${formatAvailabilityWindowDisplay(removingSlot.startTime, removingSlot.endTime)} will be removed from your schedule.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={removing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="h-11" disabled={removing} onClick={() => void handleRemoveConfirm()}>
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
