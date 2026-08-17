import { useQuery } from "@tanstack/react-query";
import { carerAvailabilityApi } from "@/lib/carer-availability";
import { carerAvailabilityWeekQueryKey } from "@/lib/carer-availability-month-queries";

export function useCarerAvailabilityWeek(weekStart: string) {
  return useQuery({
    queryKey: carerAvailabilityWeekQueryKey(weekStart),
    queryFn: () => carerAvailabilityApi.list(weekStart),
  });
}
