import { useQuery } from "@tanstack/react-query";
import {
  carerAvailabilityApi,
  type CarerUpcomingAvailabilityResponse,
  type UpcomingAvailabilityPageSize,
} from "@/lib/carer-availability";

export function carerAvailabilityUpcomingQueryKey(
  page: number,
  pageSize: UpcomingAvailabilityPageSize,
) {
  return ["carer-availability-upcoming", page, pageSize] as const;
}

export function useCarerUpcomingAvailability(
  page: number,
  pageSize: UpcomingAvailabilityPageSize,
) {
  return useQuery({
    queryKey: carerAvailabilityUpcomingQueryKey(page, pageSize),
    queryFn: () => carerAvailabilityApi.listUpcoming({ page, pageSize }),
  });
}

export function upcomingAvailabilityRangeLabel(
  data: CarerUpcomingAvailabilityResponse | undefined,
): string | null {
  if (!data || data.totalDates === 0) return null;
  const start = (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.totalDates);
  return `Showing ${start}–${end} of ${data.totalDates} dates`;
}
