import { api } from "@/lib/api";

export type CarerShiftStatus = "upcoming" | "today" | "completed" | "cancelled";

export type CarerShiftCancellationRequest = {
  status: "pending";
  requestedAt: string;
  reason?: string;
};

export type CarerShift = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  status: CarerShiftStatus;
  centre: {
    name: string;
    address: string;
    city: string;
  };
  cancellationRequest?: CarerShiftCancellationRequest | null;
};

export type CarerShiftPageSize = 10 | 25;

export type CarerShiftsPageResponse = {
  items: CarerShift[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CarerShiftsSummaryResponse = {
  items: CarerShift[];
};

export const carerShiftsApi = {
  summary: (limit = 3) =>
    api.get<CarerShiftsSummaryResponse>("/staff-portal/shifts/summary", { limit }),

  upcoming: (page: number, pageSize: CarerShiftPageSize) =>
    api.get<CarerShiftsPageResponse>("/staff-portal/shifts/upcoming", { page, pageSize }),

  history: (page: number, pageSize: CarerShiftPageSize) =>
    api.get<CarerShiftsPageResponse>("/staff-portal/shifts/history", { page, pageSize }),

  get: (id: string) => api.get<CarerShift>(`/staff-portal/shifts/${id}`),

  submitCancellationRequest: (id: string, reason: string) =>
    api.post<{ id: string; shiftId: string; status: string; reason: string; requestedAt: string }>(
      `/staff-portal/shifts/${id}/cancellation-request`,
      { reason },
    ),
};
