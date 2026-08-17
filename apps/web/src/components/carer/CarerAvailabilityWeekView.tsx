import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  addDaysToDateString,
  formatCompactWeekDayLabel,
  formatWeekRangeLabel,
  isBeforeCurrentTorontoWeek,
  isPastCalendarDate,
  isTodayCalendarDate,
  slotToCalendarDate,
  torontoTodayDateString,
  weekDayDates,
} from "@/lib/carer-availability-dates";
import { useCarerAvailabilityWeek } from "@/lib/carer-availability-week-queries";
import type { CarerAvailabilitySlot } from "@/lib/carer-availability";
import {
  CarerAvailabilityLoadError,
  CarerAvailabilityLoadingCard,
  type useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";
import {
  CarerAvailabilitySelectedDayPanel,
  sortSlotsByStartTime,
} from "@/components/carer/CarerAvailabilitySelectedDayPanel";

type CarerAvailabilityWeekViewProps = {
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  mutations: ReturnType<typeof useCarerAvailabilitySlotMutations>;
};

export function CarerAvailabilityWeekView({
  weekStart,
  onWeekStartChange,
  selectedDate,
  onSelectedDateChange,
  mutations,
}: CarerAvailabilityWeekViewProps) {
  const today = torontoTodayDateString();
  const { data: slots = [], isLoading, isFetching, isError, refetch } =
    useCarerAvailabilityWeek(weekStart);

  const weekDates = useMemo(() => weekDayDates(weekStart), [weekStart]);
  const prevDisabled = isBeforeCurrentTorontoWeek(weekStart, today);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, CarerAvailabilitySlot[]>();
    for (const slot of slots) {
      const date = slotToCalendarDate(slot);
      const list = map.get(date) ?? [];
      list.push(slot);
      map.set(date, list);
    }
    for (const [date, daySlots] of map) {
      map.set(date, sortSlotsByStartTime(daySlots));
    }
    return map;
  }, [slots]);

  const selectedDaySlots = slotsByDate.get(selectedDate) ?? [];

  function goToPreviousWeek() {
    if (prevDisabled) return;
    onWeekStartChange(addDaysToDateString(weekStart, -7));
  }

  function goToNextWeek() {
    onWeekStartChange(addDaysToDateString(weekStart, 7));
  }

  return (
    <div className="space-y-4">
      {isError ? <CarerAvailabilityLoadError onRetry={() => void refetch()} /> : null}

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={goToPreviousWeek}
              disabled={prevDisabled || isLoading}
              aria-label="Previous week"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Button>
            <CardTitle className="text-center text-base font-semibold sm:text-lg">
              {formatWeekRangeLabel(weekStart)}
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={goToNextWeek}
              disabled={isLoading}
              aria-label="Next week"
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
          {isFetching && !isLoading ? (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Refreshing week…
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 px-3 pb-4 sm:px-4">
          {isLoading ? (
            <CarerAvailabilityLoadingCard />
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDates.map((date) => {
                const daySlots = slotsByDate.get(date) ?? [];
                const isSelected = date === selectedDate;
                const isToday = isTodayCalendarDate(date, today);
                const isPast = isPastCalendarDate(date, today);
                const windowCount = daySlots.length;

                return (
                  <Button
                    key={date}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "flex h-auto min-h-16 flex-col gap-1 px-1 py-2 text-xs sm:min-h-[4.5rem] sm:text-sm",
                      isPast && !isSelected && "text-muted-foreground opacity-70",
                      isToday && !isSelected && "border-primary/40 bg-primary/5",
                    )}
                    aria-pressed={isSelected}
                    aria-label={
                      windowCount > 0
                        ? `${formatCompactWeekDayLabel(date)}, ${windowCount} windows`
                        : formatCompactWeekDayLabel(date)
                    }
                    onClick={() => onSelectedDateChange(date)}
                  >
                    <span className="font-medium">{formatCompactWeekDayLabel(date)}</span>
                    {windowCount > 0 ? (
                      <span className="text-[10px] font-normal opacity-90 sm:text-xs">
                        {windowCount === 1 ? "1 window" : `${windowCount} windows`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-normal opacity-60 sm:text-xs">—</span>
                    )}
                  </Button>
                );
              })}
            </div>
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
  );
}
