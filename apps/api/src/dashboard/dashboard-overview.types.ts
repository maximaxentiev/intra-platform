import type { ActivityLogItem } from '../reports/types/activity-log.types';
import type { DocumentComplianceSummary } from '../reports/types/document-report.types';

export const DASHBOARD_TODAY_SHIFTS_LIMIT = 12;
export const DASHBOARD_URGENT_PENDING_LIMIT = 5;
export const DASHBOARD_NEXT7_PENDING_LIMIT = 5;
export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 6;
export const DASHBOARD_RECENT_FAILURES_LIMIT = 5;
export const DASHBOARD_COMMUNICATION_FAILURE_WINDOW_HOURS = 24;
export const DASHBOARD_COMMUNICATION_FAILURE_WINDOW_MS =
  DASHBOARD_COMMUNICATION_FAILURE_WINDOW_HOURS * 60 * 60 * 1000;

export interface ShiftStatusCounts {
  total: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
}

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

export interface DashboardTodaySection {
  date: string;
  total: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
  shifts: DashboardTodayShiftItem[];
  hasMoreShifts: boolean;
}

export interface DashboardUrgentPendingShiftItem {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreId: string;
  centreName: string;
  role: string;
  status: 'pending';
  startsAt: string;
  minutesUntilStart: number;
}

export interface DashboardAttentionDocuments {
  pendingReview: number;
  issueFlagged: number;
  expired: number;
}

export interface DashboardCommunicationFailureItem {
  type: 'assignment_confirmation' | 'automated_communication';
  occurredAt: string;
  shiftId: string | null;
  centreId: string | null;
  centreName: string | null;
  staffId: string | null;
  staffName: string | null;
  communicationType: string | null;
}

export interface DashboardAttentionCommunications {
  windowHours: typeof DASHBOARD_COMMUNICATION_FAILURE_WINDOW_HOURS;
  failedAssignmentConfirmations: number;
  failedAutomatedCommunications: number;
  totalFailures: number;
  recentFailures: DashboardCommunicationFailureItem[];
}

export interface DashboardAttentionSection {
  urgentPendingShifts: DashboardUrgentPendingShiftItem[];
  totalUrgentPendingCount: number;
  hasMoreUrgentPending: boolean;
  documents: DashboardAttentionDocuments;
  communications: DashboardAttentionCommunications;
}

export interface DashboardNext7PendingShiftItem {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreId: string;
  centreName: string;
  role: string;
  status: 'pending';
}

export interface DashboardNext7DaysSection {
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
}

export interface DashboardStaffReadiness {
  staffCount: number;
  portalActive: number;
  noAccount: number;
  invited: number;
  incomplete: number;
  disabled: number;
}

export interface DashboardOverviewResponse {
  generatedAt: string;
  timezone: 'America/Toronto';
  today: DashboardTodaySection;
  attention: DashboardAttentionSection;
  next7Days: DashboardNext7DaysSection;
  documents: DocumentComplianceSummary;
  staffReadiness: DashboardStaffReadiness;
  recentActivity: ActivityLogItem[];
}
