import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  carerShiftDetailQueryKey,
  carerShiftsHistoryQueryKey,
  carerShiftsSummaryQueryKey,
  carerShiftsUpcomingQueryKey,
} from "@/lib/carer-shifts-queries";
import type { CarerShift } from "@/lib/carer-shifts";

export function useCancelCarerShift(shiftId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) =>
      api.post<CarerShift>(`/staff-portal/shifts/${shiftId}/cancel`, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: carerShiftDetailQueryKey(shiftId) });
      void qc.invalidateQueries({ queryKey: ["carer-shifts-upcoming"] });
      void qc.invalidateQueries({ queryKey: ["carer-shifts-history"] });
      void qc.invalidateQueries({ queryKey: ["carer-shifts-summary"] });
    },
  });
}

export function isCarerCancellationEligible(shift: CarerShift): boolean {
  return shift.status === "upcoming" || shift.status === "today";
}
