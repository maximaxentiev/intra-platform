import { api } from "@/lib/api";
import type {
  CentreUsageResponse,
  ShiftFulfillmentResponse,
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
};
