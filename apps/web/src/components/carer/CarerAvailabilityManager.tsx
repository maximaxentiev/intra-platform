import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  currentMondayWeekStart,
  currentTorontoMonthYear,
  mondayOfDateString,
  torontoTodayDateString,
  type MonthYear,
} from "@/lib/carer-availability-dates";
import {
  CarerAvailabilityFormDialog,
  CarerAvailabilityRemoveDialog,
  useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";
import { CarerAvailabilityMonthView } from "@/components/carer/CarerAvailabilityCalendar";
import { CarerAvailabilityWeekView } from "@/components/carer/CarerAvailabilityWeekView";
import { CarerAvailabilityUpcomingList } from "@/components/carer/CarerAvailabilityUpcomingList";

type AvailabilityViewMode = "week" | "month";

function AvailabilityViewToggle({
  value,
  onChange,
}: {
  value: AvailabilityViewMode;
  onChange: (mode: AvailabilityViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Availability view"
      className="inline-flex rounded-lg border bg-muted/30 p-1"
    >
      {(["week", "month"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={value === mode}
          className={cn(
            "min-h-11 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors",
            value === mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(mode)}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export function CarerAvailabilityManager() {
  const today = torontoTodayDateString();
  const [viewMode, setViewMode] = useState<AvailabilityViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(() => currentMondayWeekStart(today));
  const [displayMonth, setDisplayMonth] = useState<MonthYear>(() => currentTorontoMonthYear(today));

  const mutations = useCarerAvailabilitySlotMutations();

  function handleViewChange(next: AvailabilityViewMode) {
    if (next === "month") {
      const { year, month } = (() => {
        const parts = selectedDate.split("-").map(Number);
        return { year: parts[0]!, month: parts[1]! };
      })();
      setDisplayMonth({ year, month });
    } else {
      setWeekStart(mondayOfDateString(selectedDate));
    }
    setViewMode(next);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <AvailabilityViewToggle value={viewMode} onChange={handleViewChange} />

      {viewMode === "week" ? (
        <CarerAvailabilityWeekView
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          mutations={mutations}
        />
      ) : (
        <CarerAvailabilityMonthView
          displayMonth={displayMonth}
          onDisplayMonthChange={setDisplayMonth}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          mutations={mutations}
        />
      )}

      <CarerAvailabilityUpcomingList
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setWeekStart(mondayOfDateString(date));
          const [year, month] = date.split("-").map(Number);
          setDisplayMonth({ year: year!, month: month! });
        }}
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
