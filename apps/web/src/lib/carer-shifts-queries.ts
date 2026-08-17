import { useQuery } from "@tanstack/react-query";
import {
  carerShiftsApi,
  type CarerShiftPageSize,
} from "@/lib/carer-shifts";

export function carerShiftsSummaryQueryKey(limit = 3) {
  return ["carer-shifts-summary", limit] as const;
}

export function carerShiftsUpcomingQueryKey(page: number, pageSize: CarerShiftPageSize) {
  return ["carer-shifts-upcoming", page, pageSize] as const;
}

export function carerShiftsHistoryQueryKey(page: number, pageSize: CarerShiftPageSize) {
  return ["carer-shifts-history", page, pageSize] as const;
}

export function useCarerShiftsSummary(limit = 3) {
  return useQuery({
    queryKey: carerShiftsSummaryQueryKey(limit),
    queryFn: () => carerShiftsApi.summary(limit),
  });
}

export function useCarerShiftsUpcoming(
  page: number,
  pageSize: CarerShiftPageSize,
  enabled = true,
) {
  return useQuery({
    queryKey: carerShiftsUpcomingQueryKey(page, pageSize),
    queryFn: () => carerShiftsApi.upcoming(page, pageSize),
    enabled,
  });
}

export function useCarerShiftsHistory(
  page: number,
  pageSize: CarerShiftPageSize,
  enabled: boolean,
) {
  return useQuery({
    queryKey: carerShiftsHistoryQueryKey(page, pageSize),
    queryFn: () => carerShiftsApi.history(page, pageSize),
    enabled,
  });
}
