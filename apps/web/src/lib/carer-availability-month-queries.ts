import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { carerAvailabilityApi, type CarerAvailabilitySlot } from "@/lib/carer-availability";
import { type MonthYear, weekStartsForMonth } from "@/lib/carer-availability-dates";

export function carerAvailabilityWeekQueryKey(weekStart: string) {
  return ["carer-availability", weekStart] as const;
}

export function useCarerAvailabilityMonthWeeks(monthYear: MonthYear) {
  const weekStarts = useMemo(
    () => weekStartsForMonth(monthYear),
    [monthYear.year, monthYear.month],
  );

  const queries = useQueries({
    queries: weekStarts.map((weekStart) => ({
      queryKey: carerAvailabilityWeekQueryKey(weekStart),
      queryFn: () => carerAvailabilityApi.list(weekStart),
    })),
  });

  const slots = useMemo(() => {
    const merged: CarerAvailabilitySlot[] = [];
    const seen = new Set<string>();
    for (const query of queries) {
      for (const slot of query.data ?? []) {
        if (!seen.has(slot.id)) {
          seen.add(slot.id);
          merged.push(slot);
        }
      }
    }
    return merged;
  }, [queries]);

  const isLoading = queries.some((query) => query.isLoading && query.data === undefined);
  const isFetching = queries.some((query) => query.isFetching);
  const isError = queries.some((query) => query.isError);

  async function refetch() {
    await Promise.all(queries.map((query) => query.refetch()));
  }

  return {
    weekStarts,
    slots,
    isLoading,
    isFetching,
    isError,
    refetch,
    queries,
  };
}
