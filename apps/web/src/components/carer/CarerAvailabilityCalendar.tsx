import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  addMonthsToMonthYear,
  currentTorontoMonthYear,
  dateStringToLocalDate,
  defaultSelectedDateForMonth,
  formatFullCalendarDateLabel,
  isBeforeCurrentTorontoMonth,
  isDateInMonthYear,
  isPastCalendarDate,
  localDateToDateString,
  formatMonthYearLabel,
  slotToCalendarDate,
  torontoTodayDateString,
  type MonthYear,
} from "@/lib/carer-availability-dates";
import { useCarerAvailabilityMonthWeeks } from "@/lib/carer-availability-month-queries";
import type { CarerAvailabilitySlot } from "@/lib/carer-availability";
import {
  CarerAvailabilityAddButton,
  CarerAvailabilityFormDialog,
  CarerAvailabilityLoadError,
  CarerAvailabilityLoadingCard,
  CarerAvailabilityRemoveDialog,
  CarerAvailabilityWindowList,
  useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";

function sortSlotsByStartTime(slots: CarerAvailabilitySlot[]): CarerAvailabilitySlot[] {
  return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function CarerAvailabilityCalendar() {
  const today = torontoTodayDateString();
  const [displayMonth, setDisplayMonth] = useState<MonthYear>(() => currentTorontoMonthYear(today));
  const [selectedDate, setSelectedDate] = useState<string>(() => today);

  const { slots, isLoading, isFetching, isError, refetch } =
    useCarerAvailabilityMonthWeeks(displayMonth);

  const mutations = useCarerAvailabilitySlotMutations();

  const datesWithAvailability = useMemo(
    () =>
      Array.from(new Set(slots.map((slot) => slotToCalendarDate(slot)))).map((dateStr) =>
        dateStringToLocalDate(dateStr),
      ),
    [slots],
  );

  const selectedDaySlots = useMemo(
    () => sortSlotsByStartTime(slots.filter((slot) => slotToCalendarDate(slot) === selectedDate)),
    [slots, selectedDate],
  );

  const selectedIsPast = isPastCalendarDate(selectedDate, today);
  const prevDisabled = isBeforeCurrentTorontoMonth(displayMonth, today);

  function goToPreviousMonth() {
    if (prevDisabled) return;
    const nextMonth = addMonthsToMonthYear(displayMonth, -1);
    setDisplayMonth(nextMonth);
    if (!isDateInMonthYear(selectedDate, nextMonth)) {
      setSelectedDate(defaultSelectedDateForMonth(nextMonth, today));
    }
  }

  function goToNextMonth() {
    const nextMonth = addMonthsToMonthYear(displayMonth, 1);
    setDisplayMonth(nextMonth);
    if (!isDateInMonthYear(selectedDate, nextMonth)) {
      setSelectedDate(defaultSelectedDateForMonth(nextMonth, today));
    }
  }

  function handleSelectDate(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(localDateToDateString(date));
  }

  const monthDate = dateStringToLocalDate(
    `${displayMonth.year}-${String(displayMonth.month).padStart(2, "0")}-01`,
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {isError ? <CarerAvailabilityLoadError onRetry={() => void refetch()} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={goToPreviousMonth}
                disabled={prevDisabled || isLoading}
                aria-label="Previous month"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Button>
              <CardTitle className="text-center text-base font-semibold sm:text-lg">
                {formatMonthYearLabel(displayMonth)}
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={goToNextMonth}
                disabled={isLoading}
                aria-label="Next month"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </Button>
            </div>
            {isFetching && !isLoading ? (
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                Refreshing month…
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-4">
            {isLoading ? (
              <CarerAvailabilityLoadingCard />
            ) : (
              <Calendar
                mode="single"
                month={monthDate}
                selected={dateStringToLocalDate(selectedDate)}
                onSelect={handleSelectDate}
                showOutsideDays
                hideNavigation
                className="mx-auto w-full max-w-none [--cell-size:2.5rem] sm:[--cell-size:2.75rem]"
                modifiers={{
                  has_availability: datesWithAvailability,
                  past_in_month: (date) =>
                    isPastCalendarDate(localDateToDateString(date), today) &&
                    date.getMonth() === displayMonth.month - 1 &&
                    date.getFullYear() === displayMonth.year,
                }}
                modifiersClassNames={{
                  has_availability:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
                  past_in_month: "text-muted-foreground opacity-60",
                }}
                classNames={{
                  root: "w-full",
                  month: "w-full gap-3",
                  table: "w-full",
                  day: "flex-1",
                }}
                components={{
                  DayButton: ({ day, modifiers, className, ...props }) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className={cn(
                        "aspect-square h-auto w-full min-h-11 font-normal",
                        modifiers.selected &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                        modifiers.today &&
                          !modifiers.selected &&
                          "border border-primary/40 bg-primary/5",
                        className,
                      )}
                      aria-label={
                        modifiers.has_availability
                          ? `${localDateToDateString(day.date)}, has availability`
                          : localDateToDateString(day.date)
                      }
                      {...props}
                    >
                      <span>{day.date.getDate()}</span>
                      {modifiers.has_availability ? (
                        <span className="sr-only">Has availability</span>
                      ) : null}
                    </Button>
                  ),
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {formatFullCalendarDateLabel(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CarerAvailabilityWindowList
              slots={selectedDaySlots}
              dayName={formatFullCalendarDateLabel(selectedDate)}
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
