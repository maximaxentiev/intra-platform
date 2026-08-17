import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  calendarDateToWeekDay,
  formatAvailabilityWindowDisplay,
  formatFullCalendarDateLabel,
  isPastCalendarDate,
  torontoTodayDateString,
} from "@/lib/carer-availability-dates";
import {
  upcomingAvailabilityRangeLabel,
  useCarerUpcomingAvailability,
} from "@/lib/carer-availability-upcoming";
import type {
  CarerAvailabilitySlot,
  CarerUpcomingAvailabilityWindow,
  UpcomingAvailabilityPageSize,
} from "@/lib/carer-availability";
import {
  CarerAvailabilityLoadError,
  type useCarerAvailabilitySlotMutations,
} from "@/components/carer/CarerAvailabilityShared";
import { Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE_OPTIONS: UpcomingAvailabilityPageSize[] = [10, 25, 50];

function upcomingWindowToSlot(
  window: CarerUpcomingAvailabilityWindow,
  calendarDate: string,
): CarerAvailabilitySlot {
  const { weekStartDate, dayOfWeek } = calendarDateToWeekDay(calendarDate);
  return {
    id: window.id,
    weekStartDate,
    dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    createdAt: "",
  };
}

type CarerAvailabilityUpcomingListProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  mutations: Pick<
    ReturnType<typeof useCarerAvailabilitySlotMutations>,
    "openEdit" | "setRemovingSlot" | "saving" | "removing"
  >;
};

export function CarerAvailabilityUpcomingList({
  selectedDate,
  onSelectDate,
  mutations,
}: CarerAvailabilityUpcomingListProps) {
  const today = torontoTodayDateString();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<UpcomingAvailabilityPageSize>(10);

  const { data, isLoading, isError, refetch } = useCarerUpcomingAvailability(page, pageSize);
  const rangeLabel = upcomingAvailabilityRangeLabel(data ?? undefined);

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value) as UpcomingAvailabilityPageSize);
    setPage(1);
  }

  return (
    <Card id="upcoming-availability" className="scroll-mt-4">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base font-semibold">Upcoming availability</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-11 w-[5.5rem]" aria-label="Upcoming availability page size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? <CarerAvailabilityLoadError onRetry={() => void refetch()} /> : null}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading upcoming availability…
          </p>
        ) : null}

        {!isLoading && !isError && (data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming availability added.</p>
        ) : null}

        {!isLoading && !isError && data && data.items.length > 0 ? (
          <ul className="space-y-4">
            {data.items.map((item) => {
              const isPast = isPastCalendarDate(item.calendarDate, today);
              const isSelected = item.calendarDate === selectedDate;
              return (
                <li
                  key={item.calendarDate}
                  className={`rounded-md border p-3 ${isSelected ? "border-primary/50 bg-primary/5" : "bg-background"}`}
                >
                  <button
                    type="button"
                    className="mb-2 text-left text-sm font-semibold hover:underline"
                    onClick={() => onSelectDate(item.calendarDate)}
                  >
                    {formatFullCalendarDateLabel(item.calendarDate)}
                  </button>
                  <ul className="space-y-2">
                    {item.windows.map((window) => {
                      const slot = upcomingWindowToSlot(window, item.calendarDate);
                      return (
                        <li
                          key={window.id}
                          className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-medium">
                            {formatAvailabilityWindowDisplay(window.startTime, window.endTime)}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {!isPast ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-11"
                                disabled={mutations.saving || mutations.removing}
                                onClick={() => mutations.openEdit(slot)}
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
                              disabled={mutations.saving || mutations.removing}
                              onClick={() => mutations.setRemovingSlot(slot)}
                            >
                              <Trash2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : null}

        {data && data.totalPages > 1 ? (
          <div className="space-y-3">
            {rangeLabel ? (
              <p className="text-sm text-muted-foreground">{rangeLabel}</p>
            ) : null}
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={page >= data.totalPages ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < data.totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : rangeLabel ? (
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
