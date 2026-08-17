import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  carerShiftDetailQueryKey,
  carerShiftsHistoryQueryKey,
  carerShiftsSummaryQueryKey,
  carerShiftsUpcomingQueryKey,
} from "@/lib/carer-shifts-queries";
import type { CarerShift } from "@/lib/carer-shifts";

export type CarerCancellationRequest = {
  id: string;
  shiftId: string;
  status: "pending" | "resolved";
  reason: string;
  requestedAt: string;
};

export function useSubmitCarerCancellationRequest(shiftId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) =>
      api.post<CarerCancellationRequest>(`/staff-portal/shifts/${shiftId}/cancellation-request`, {
        reason,
      }),
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

export function hasPendingCancellationRequest(shift: CarerShift): boolean {
  return shift.cancellationRequest?.status === "pending";
}
