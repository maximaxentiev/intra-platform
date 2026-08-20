import { api } from "@/lib/api";
import type {
  CentreUsageResponse,
  ShiftFulfillmentResponse,
  StaffUsageResponse,
  StaffUsageShiftsResponse,
} from "@/lib/reports-types";

export const reportsApi = {
  shiftFulfillment: (query?: {
    dateFrom?: string;
    dateTo?: string;
    centreId?: string;
  }) => api.get<ShiftFulfillmentResponse>("/reports/shift-fulfillment", query),

  centreUsage: (query?: {
    dateFrom?: string;
    dateTo?: string;
    centreIds?: string[];
    centreId?: string;
  }) => api.get<CentreUsageResponse>("/reports/centre-usage", query),

  staffUsage: (query?: {
    dateFrom?: string;
    dateTo?: string;
    staffIds?: string[];
    staffId?: string;
  }) => api.get<StaffUsageResponse>("/reports/staff-usage", query),

  staffUsageShifts: (
    staffId: string,
    query?: {
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) => api.get<StaffUsageShiftsResponse>(`/reports/staff-usage/${staffId}/shifts`, query),
};
