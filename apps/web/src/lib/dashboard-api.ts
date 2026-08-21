import { api } from "./api";
import type { ActivityLogItem } from "./reports-types";

export interface DashboardTodayShiftItem {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreId: string;
  centreName: string;
  role: string;
  status: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  startsAt: string;
  minutesUntilStart: number;
}

export interface DashboardUrgentPendingShiftItem {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreId: string;
  centreName: string;
  role: string;
  status: "pending";
  startsAt: string;
  minutesUntilStart: number;
}

export interface DashboardNext7PendingShiftItem {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreId: string;
  centreName: string;
  role: string;
  status: "pending";
}

export interface DashboardCommunicationFailureItem {
  type: "assignment_confirmation" | "automated_communication";
  occurredAt: string;
  shiftId: string | null;
  centreId: string | null;
  centreName: string | null;
  staffId: string | null;
  staffName: string | null;
  communicationType: string | null;
}

export interface DocumentComplianceSummary {
  staffShown: number;
  compliant: number;
  expiringSoon: number;
  needsAttention: number;
  pendingReview: number;
  issueFlagged: number;
  expired: number;
}

export interface DashboardOverviewResponse {
  generatedAt: string;
  timezone: "America/Toronto";
  today: {
    date: string;
    total: number;
    pending: number;
    filled: number;
    completed: number;
    cancelled: number;
    shifts: DashboardTodayShiftItem[];
    hasMoreShifts: boolean;
  };
  attention: {
    urgentPendingShifts: DashboardUrgentPendingShiftItem[];
    totalUrgentPendingCount: number;
    hasMoreUrgentPending: boolean;
    documents: {
      pendingReview: number;
      issueFlagged: number;
      expired: number;
    };
    communications: {
      failedAssignmentConfirmations: number;
      failedAutomatedCommunications: number;
      totalFailures: number;
      recentFailures: DashboardCommunicationFailureItem[];
    };
  };
  next7Days: {
    dateFrom: string;
    dateTo: string;
    total: number;
    pending: number;
    filled: number;
    completed: number;
    cancelled: number;
    fillRate: number | null;
    pendingShifts: DashboardNext7PendingShiftItem[];
    totalPendingCount: number;
    hasMorePendingShifts: boolean;
  };
  documents: DocumentComplianceSummary;
  staffReadiness: {
    activeStaff: number;
    portalActive: number;
    noAccount: number;
    invited: number;
    incomplete: number;
    disabled: number;
  };
  recentActivity: ActivityLogItem[];
}

export const dashboardOverviewApi = {
  overview: () => api.get<DashboardOverviewResponse>("/dashboard/overview"),
};
