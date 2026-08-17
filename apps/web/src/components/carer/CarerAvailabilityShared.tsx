import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  CARER_DAY_NAMES,
  calendarDateToWeekDay,
  formatAvailabilityWindowDisplay,
  formatShortCalendarDate,
  isPastCalendarDate,
  isTodayCalendarDate,
  slotToCalendarDate,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import {
  carerAvailabilityApi,
  mapAvailabilityApiError,
  validateClientTimeRange,
  type CarerAvailabilitySlot,
} from "@/lib/carer-availability";

export const DEFAULT_AVAILABILITY_START = "09:00";
export const DEFAULT_AVAILABILITY_END = "17:00";

export type AvailabilityFormState = {
  kind: "add" | "edit";
  weekStartDate: string;
  dayOfWeek: number;
  calendarDate: string;
  slotId?: string;
  startTime: string;
  endTime: string;
};

type CarerAvailabilityFormDialogProps = {
  form: AvailabilityFormState | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChange: (patch: Partial<Pick<AvailabilityFormState, "startTime" | "endTime">>) => void;
  onSave: () => void;
};

export function CarerAvailabilityFormDialog({
  form,
  saving,
  error,
  onClose,
  onChange,
  onSave,
}: CarerAvailabilityFormDialogProps) {
  const dayLabel = form
    ? `${CARER_DAY_NAMES[form.dayOfWeek]} · ${formatShortCalendarDate(form.calendarDate)}`
    : "";

  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form?.kind === "add" ? "Add availability" : "Edit availability"}</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carer-availability-start">Start time</Label>
            <Input
              id="carer-availability-start"
              type="time"
              className="h-11"
              value={form?.startTime ?? DEFAULT_AVAILABILITY_START}
              onChange={(e) => onChange({ startTime: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carer-availability-end">End time</Label>
            <Input
              id="carer-availability-end"
              type="time"
              className="h-11"
              value={form?.endTime ?? DEFAULT_AVAILABILITY_END}
              onChange={(e) => onChange({ endTime: e.target.value })}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="h-11" disabled={saving} onClick={onSave}>
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
  );
}

type CarerAvailabilityRemoveDialogProps = {
  slot: CarerAvailabilitySlot | null;
  removing: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CarerAvailabilityRemoveDialog({
  slot,
  removing,
  onClose,
  onConfirm,
}: CarerAvailabilityRemoveDialogProps) {
  return (
    <AlertDialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this availability?</AlertDialogTitle>
          <AlertDialogDescription>
            {slot
              ? `${formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)} will be removed from your schedule.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" disabled={removing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction className="h-11" disabled={removing} onClick={onConfirm}>
            {removing ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type CarerAvailabilityWindowListProps = {
  slots: CarerAvailabilitySlot[];
  dayName: string;
  allowEdit: boolean;
  allowRemove: boolean;
  busy?: boolean;
  emptyMessage?: string;
  onEdit: (slot: CarerAvailabilitySlot) => void;
  onRemove: (slot: CarerAvailabilitySlot) => void;
};

export function CarerAvailabilityWindowList({
  slots,
  dayName,
  allowEdit,
  allowRemove,
  busy = false,
  emptyMessage,
  onEdit,
  onRemove,
}: CarerAvailabilityWindowListProps) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "No availability added"}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {slots.map((slot) => (
        <li
          key={slot.id}
          className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm font-medium">
            {formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)}
          </span>
          <div className="flex flex-wrap gap-2">
            {allowEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                onClick={() => onEdit(slot)}
                disabled={busy}
                aria-label={`Edit availability ${formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)} on ${dayName}`}
              >
                <Pencil aria-hidden="true" className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {allowRemove ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                onClick={() => onRemove(slot)}
                disabled={busy}
                aria-label={`Remove availability ${formatAvailabilityWindowDisplay(slot.startTime, slot.endTime)} on ${dayName}`}
              >
                <Trash2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

type UseCarerAvailabilitySlotMutationsOptions = {
  onAfterMutation?: () => Promise<unknown> | void;
};

export function useCarerAvailabilitySlotMutations({
  onAfterMutation,
}: UseCarerAvailabilitySlotMutationsOptions = {}) {
  const queryClient = useQueryClient();
  const today = torontoTodayDateString();

  const [form, setForm] = useState<AvailabilityFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingSlot, setRemovingSlot] = useState<CarerAvailabilitySlot | null>(null);
  const [removing, setRemoving] = useState(false);

  async function invalidateAfterMutation(weekStartDate: string) {
    await queryClient.invalidateQueries({ queryKey: ["carer-availability", weekStartDate] });
    await queryClient.invalidateQueries({ queryKey: ["carer-availability-upcoming"] });
    await onAfterMutation?.();
  }

  function openAdd(calendarDate: string) {
    const { weekStartDate, dayOfWeek } = calendarDateToWeekDay(calendarDate);
    setFormError(null);
    setForm({
      kind: "add",
      weekStartDate,
      dayOfWeek,
      calendarDate,
      startTime: DEFAULT_AVAILABILITY_START,
      endTime: DEFAULT_AVAILABILITY_END,
    });
  }

  function openEdit(slot: CarerAvailabilitySlot) {
    const calendarDate = slotToCalendarDate(slot);
    setFormError(null);
    setForm({
      kind: "edit",
      weekStartDate: slot.weekStartDate,
      dayOfWeek: slot.dayOfWeek,
      calendarDate,
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
          weekStartDate: form.weekStartDate,
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
      await invalidateAfterMutation(form.weekStartDate);
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
      await invalidateAfterMutation(removingSlot.weekStartDate);
    } catch (err) {
      toast.error(mapAvailabilityApiError(err, "Could not remove availability."));
    } finally {
      setRemoving(false);
    }
  }

  const dayHelpers = useMemo(
    () => ({
      isPast: (calendarDate: string) => isPastCalendarDate(calendarDate, today),
      isToday: (calendarDate: string) => isTodayCalendarDate(calendarDate, today),
    }),
    [today],
  );

  return {
    form,
    formError,
    saving,
    removingSlot,
    removing,
    setForm,
    setRemovingSlot,
    openAdd,
    openEdit,
    handleSaveForm,
    handleRemoveConfirm,
    dayHelpers,
  };
}

export function CarerAvailabilityLoadError({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>Could not load availability.</p>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-destructive"
          onClick={() => void onRetry()}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

export function CarerAvailabilityLoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading availability…
      </CardContent>
    </Card>
  );
}

export function CarerAvailabilityAddButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-11"
      onClick={onClick}
      disabled={disabled}
    >
      <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
      Add availability
    </Button>
  );
}
