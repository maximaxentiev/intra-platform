import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatFullCalendarDateLabel,
  isPastCalendarDate,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import type { CarerAvailabilitySlot } from "@/lib/carer-availability";
import {
  CarerAvailabilityAddButton,
  CarerAvailabilityWindowList,
  type useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";

export function sortSlotsByStartTime(slots: CarerAvailabilitySlot[]): CarerAvailabilitySlot[] {
  return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

type CarerAvailabilitySelectedDayPanelProps = {
  selectedDate: string;
  slots: CarerAvailabilitySlot[];
  mutations: Pick<
    ReturnType<typeof useCarerAvailabilitySlotMutations>,
    "openAdd" | "openEdit" | "setRemovingSlot" | "saving" | "removing"
  >;
  isLoading?: boolean;
  className?: string;
};

export function CarerAvailabilitySelectedDayPanel({
  selectedDate,
  slots,
  mutations,
  isLoading = false,
  className,
}: CarerAvailabilitySelectedDayPanelProps) {
  const today = torontoTodayDateString();
  const selectedIsPast = isPastCalendarDate(selectedDate, today);
  const selectedDaySlots = sortSlotsByStartTime(slots);
  const dayLabel = formatFullCalendarDateLabel(selectedDate);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{dayLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CarerAvailabilityWindowList
          slots={selectedDaySlots}
          dayName={dayLabel}
          allowEdit={!selectedIsPast}
          allowRemove
          busy={mutations.saving || mutations.removing}
          emptyMessage="No availability added for this day."
          onEdit={(slot) => mutations.openEdit(slot)}
          onRemove={(slot) => mutations.setRemovingSlot(slot)}
        />
        {!selectedIsPast ? (
          <CarerAvailabilityAddButton
            onClick={() => mutations.openAdd(selectedDate)}
            disabled={mutations.saving || isLoading}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
