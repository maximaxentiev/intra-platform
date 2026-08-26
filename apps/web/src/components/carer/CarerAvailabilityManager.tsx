import { useState } from "react";
import {
  currentMondayWeekStart,
  mondayOfDateString,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import {
  CarerAvailabilityFormDialog,
  CarerAvailabilityRemoveDialog,
  useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";
import { CarerAvailabilityWeekView } from "@/components/carer/CarerAvailabilityWeekView";

export function CarerAvailabilityManager() {
  const today = torontoTodayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(() => currentMondayWeekStart(today));

  const mutations = useCarerAvailabilitySlotMutations();

  function handleSelectedDateChange(date: string) {
    setSelectedDate(date);
    setWeekStart(mondayOfDateString(date));
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <CarerAvailabilityWeekView
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        selectedDate={selectedDate}
        onSelectedDateChange={handleSelectedDateChange}
        mutations={mutations}
      />

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
