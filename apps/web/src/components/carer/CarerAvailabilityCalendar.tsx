import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  addMonthsToMonthYear,
  dateStringToLocalDate,
  defaultSelectedDateForMonth,
  formatMonthYearLabel,
  isBeforeCurrentTorontoMonth,
  isDateInMonthYear,
  isPastCalendarDate,
  localDateToDateString,
  slotToCalendarDate,
  torontoTodayDateString,
  type MonthYear,
} from "@/lib/carer-availability-dates";
import { useCarerAvailabilityMonthWeeks } from "@/lib/carer-availability-month-queries";
import {
  CarerAvailabilityLoadError,
  CarerAvailabilityLoadingCard,
  type useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";
import { CarerAvailabilitySelectedDayPanel } from "@/components/carer/CarerAvailabilitySelectedDayPanel";
import { sortSlotsByStartTime } from "@/components/carer/CarerAvailabilitySelectedDayPanel";

type CarerAvailabilityMonthViewProps = {
  displayMonth: MonthYear;
  onDisplayMonthChange: (month: MonthYear) => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  mutations: ReturnType<typeof useCarerAvailabilitySlotMutations>;
};

export function CarerAvailabilityMonthView({
  displayMonth,
  onDisplayMonthChange,
  selectedDate,
  onSelectedDateChange,
  mutations,
}: CarerAvailabilityMonthViewProps) {
  const today = torontoTodayDateString();
  const { slots, isLoading, isFetching, isError, refetch } =
    useCarerAvailabilityMonthWeeks(displayMonth);

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

  const prevDisabled = isBeforeCurrentTorontoMonth(displayMonth, today);

  function goToPreviousMonth() {
    if (prevDisabled) return;
    const nextMonth = addMonthsToMonthYear(displayMonth, -1);
    onDisplayMonthChange(nextMonth);
    if (!isDateInMonthYear(selectedDate, nextMonth)) {
      onSelectedDateChange(defaultSelectedDateForMonth(nextMonth, today));
    }
  }

  function goToNextMonth() {
    const nextMonth = addMonthsToMonthYear(displayMonth, 1);
    onDisplayMonthChange(nextMonth);
    if (!isDateInMonthYear(selectedDate, nextMonth)) {
      onSelectedDateChange(defaultSelectedDateForMonth(nextMonth, today));
    }
  }

  function handleSelectDate(date: Date | undefined) {
    if (!date) return;
    onSelectedDateChange(localDateToDateString(date));
  }

  const monthDate = dateStringToLocalDate(
    `${displayMonth.year}-${String(displayMonth.month).padStart(2, "0")}-01`,
  );

  return (
    <div className="space-y-4">
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

        <CarerAvailabilitySelectedDayPanel
          selectedDate={selectedDate}
          slots={selectedDaySlots}
          mutations={mutations}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}