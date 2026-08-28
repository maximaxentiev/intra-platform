import { api } from "@/lib/api";

export type CarerShiftStatus = "upcoming" | "today" | "completed" | "cancelled";

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
    notes?: string;
  };
  cancellationReason?: string | null;
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
};
