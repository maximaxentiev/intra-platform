import { api } from "@/lib/api";
import type {
  ActivityLogResponse,
  CentreUsageResponse,
  CentreUsageShiftsResponse,
  DocumentComplianceResponse,
  ShiftFulfillmentResponse,
  StaffUsageResponse,
  StaffUsageShiftsResponse,
} from "@/lib/reports-types";

type CentreMetricQuery = {
  totalShiftsMin?: number;
  totalShiftsMax?: number;
  fillRateMin?: number;
  fillRateMax?: number;
  pendingMin?: number;
  pendingMax?: number;
  filledMin?: number;
  filledMax?: number;
  completedMin?: number;
  completedMax?: number;
  cancelledMin?: number;
  cancelledMax?: number;
  scheduledHoursMin?: number;
  scheduledHoursMax?: number;
  completedScheduledHoursMin?: number;
  completedScheduledHoursMax?: number;
};

type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export const reportsApi = {
  shiftFulfillment: (
    query?: {
      dateFrom?: string;
      dateTo?: string;
      centreIds?: string[];
      centreId?: string;
    } & CentreMetricQuery &
      PaginationQuery,
  ) => api.get<ShiftFulfillmentResponse>("/reports/shift-fulfillment", query),

  centreUsage: (
    query?: {
      dateFrom?: string;
      dateTo?: string;
      centreIds?: string[];
      centreId?: string;
      cities?: string[];
    } & CentreMetricQuery &
      PaginationQuery,
  ) => api.get<CentreUsageResponse>("/reports/centre-usage", query),

  centreUsageShifts: (
    query: {
      dateFrom?: string;
      dateTo?: string;
      centreIds: string[];
      cities?: string[];
      status?: string;
      staffIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ) => api.get<CentreUsageShiftsResponse>("/reports/centre-usage/shifts", query),

  staffUsage: (
    query?: {
      dateFrom?: string;
      dateTo?: string;
      staffIds?: string[];
      staffId?: string;
      roles?: string[];
      completedShiftsMin?: number;
      completedShiftsMax?: number;
      completedScheduledHoursMin?: number;
      completedScheduledHoursMax?: number;
      filledShiftsMin?: number;
      filledShiftsMax?: number;
      filledScheduledHoursMin?: number;
      filledScheduledHoursMax?: number;
    } & PaginationQuery,
  ) => api.get<StaffUsageResponse>("/reports/staff-usage", query),

  staffUsageShifts: (
    staffId: string,
    query?: {
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) => api.get<StaffUsageShiftsResponse>(`/reports/staff-usage/${staffId}/shifts`, query),

  documentCompliance: (
    query?: {
      staffIds?: string[];
      staffId?: string;
      status?: string;
      documentType?: string;
      overallCompliance?: string[];
      roles?: string[];
      vscStatuses?: string[];
      firstAidStatuses?: string[];
      immunizationsStatuses?: string[];
      covidStatuses?: string[];
      vscRenewalDueFrom?: string;
      vscRenewalDueTo?: string;
      firstAidExpiryFrom?: string;
      firstAidExpiryTo?: string;
      vscReminderStatuses?: string[];
      firstAidReminderStatuses?: string[];
      upcomingReminder?: string;
    } & PaginationQuery,
  ) => api.get<DocumentComplianceResponse>("/reports/documents", query),

  activityLog: (query?: {
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    actorType?: string;
    staffId?: string;
    centreId?: string;
    shiftId?: string;
    opsUserId?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<ActivityLogResponse>("/reports/activity", query),
};
