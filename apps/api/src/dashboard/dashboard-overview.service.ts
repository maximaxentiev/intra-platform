import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centres,
  scheduledCommunications,
  shiftAssignmentNotifications,
  shifts,
  staff,
  staffAccounts,
} from '../db/schema';
import { computeFillRatePercent } from '../reports/report-percentage.util';
import { formatStaffReportName, formatStaffReportRole } from '../reports/report-staff-name.util';
import { ReportsActivityService } from '../reports/reports-activity.service';
import { ReportsDocumentsService } from '../reports/reports-documents.service';
import {
  DASHBOARD_TIMEZONE,
  resolveDashboardCalendarContext,
  urgentPendingCoarseDateUpperBound,
} from './dashboard-date.util';
import {
  DASHBOARD_NEXT7_PENDING_LIMIT,
  DASHBOARD_RECENT_ACTIVITY_LIMIT,
  DASHBOARD_RECENT_FAILURES_LIMIT,
  DASHBOARD_TODAY_SHIFTS_LIMIT,
  DASHBOARD_URGENT_PENDING_LIMIT,
  type DashboardCommunicationFailureItem,
  type DashboardNext7PendingShiftItem,
  type DashboardOverviewResponse,
  type DashboardStaffReadiness,
  type DashboardTodayShiftItem,
  type DashboardUrgentPendingShiftItem,
  type ShiftStatusCounts,
} from './dashboard-overview.types';
import {
  isUrgentPendingShift,
  minutesUntilShiftStart,
  torontoShiftStartIso,
} from './dashboard-urgency.util';
import { resolvePortalAccountDisplayStatus } from '../staff-portal/portal-account-status.util';

type ShiftRow = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  status: string;
  centreId: string;
  centreName: string;
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
};

function emptyStatusCounts(): ShiftStatusCounts {
  return { total: 0, pending: 0, filled: 0, completed: 0, cancelled: 0 };
}

function countsFromStatusRows(
  rows: Array<{ status: string; count: number }>,
): ShiftStatusCounts {
  const counts = emptyStatusCounts();
  for (const row of rows) {
    const value = Number(row.count);
    counts.total += value;
    if (row.status === 'pending') counts.pending = value;
    if (row.status === 'filled') counts.filled = value;
    if (row.status === 'completed') counts.completed = value;
    if (row.status === 'cancelled') counts.cancelled = value;
  }
  return counts;
}

function mapAssignedStaffName(row: ShiftRow): string | null {
  if (!row.assignedStaffId) return null;
  return formatStaffReportName({
    legalName: row.assignedLegalName ?? '',
    displayName: row.assignedDisplayName ?? '',
    useDisplayName: row.assignedUseDisplayName ?? false,
  });
}

function mapTodayShiftItem(row: ShiftRow, now: Date): DashboardTodayShiftItem {
  return {
    shiftId: row.id,
    shiftDate: row.shiftDate,
    startTime: row.startTime,
    endTime: row.endTime,
    centreId: row.centreId,
    centreName: row.centreName,
    role: formatStaffReportRole(row.roleNeeded),
    status: row.status,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName: mapAssignedStaffName(row),
    startsAt: torontoShiftStartIso(row.shiftDate, row.startTime),
    minutesUntilStart: minutesUntilShiftStart(row.shiftDate, row.startTime, now),
  };
}

function mapUrgentPendingItem(row: ShiftRow, now: Date): DashboardUrgentPendingShiftItem {
  return {
    shiftId: row.id,
    shiftDate: row.shiftDate,
    startTime: row.startTime,
    endTime: row.endTime,
    centreId: row.centreId,
    centreName: row.centreName,
    role: formatStaffReportRole(row.roleNeeded),
    status: 'pending',
    startsAt: torontoShiftStartIso(row.shiftDate, row.startTime),
    minutesUntilStart: minutesUntilShiftStart(row.shiftDate, row.startTime, now),
  };
}

function mapNext7PendingItem(row: ShiftRow): DashboardNext7PendingShiftItem {
  return {
    shiftId: row.id,
    shiftDate: row.shiftDate,
    startTime: row.startTime,
    endTime: row.endTime,
    centreId: row.centreId,
    centreName: row.centreName,
    role: formatStaffReportRole(row.roleNeeded),
    status: 'pending',
  };
}

function compareShiftsByStartThenCentre(a: ShiftRow, b: ShiftRow): number {
  const dateCompare = a.shiftDate.localeCompare(b.shiftDate);
  if (dateCompare !== 0) return dateCompare;
  const startCompare = a.startTime.localeCompare(b.startTime);
  if (startCompare !== 0) return startCompare;
  return a.centreName.localeCompare(b.centreName);
}

function compareTodayShifts(a: ShiftRow, b: ShiftRow): number {
  const startCompare = a.startTime.localeCompare(b.startTime);
  if (startCompare !== 0) return startCompare;
  return a.centreName.localeCompare(b.centreName);
}

@Injectable()
export class DashboardOverviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly documentsReport: ReportsDocumentsService,
    private readonly activityReport: ReportsActivityService,
  ) {}

  async overview(now: Date = new Date()): Promise<DashboardOverviewResponse> {
    const calendar = resolveDashboardCalendarContext(now);
    const urgentUpper = urgentPendingCoarseDateUpperBound(calendar.today);

    const [
      todayStatusRows,
      todayShiftRows,
      urgentCandidateRows,
      next7StatusRows,
      next7PendingCandidateRows,
      documents,
      staffReadiness,
      communicationFailures,
      recentActivityResponse,
    ] = await Promise.all([
      this.loadStatusCountsForDate(calendar.today),
      this.loadShiftRowsForDate(calendar.today),
      this.loadPendingShiftRowsInDateRange(calendar.today, urgentUpper),
      this.loadStatusCountsForDateRange(calendar.next7DaysFrom, calendar.next7DaysTo),
      this.loadPendingShiftRowsInDateRange(calendar.next7DaysFrom, calendar.next7DaysTo),
      this.documentsReport.getActiveStaffComplianceSummary(),
      this.loadStaffReadiness(),
      this.loadCommunicationFailures(),
      this.activityReport.getActivityLog({
        page: 1,
        pageSize: DASHBOARD_RECENT_ACTIVITY_LIMIT,
      }),
    ]);

    const todayCounts = countsFromStatusRows(todayStatusRows);
    const sortedTodayRows = [...todayShiftRows].sort(compareTodayShifts);
    const todayShifts = sortedTodayRows
      .slice(0, DASHBOARD_TODAY_SHIFTS_LIMIT)
      .map((row) => mapTodayShiftItem(row, now));

    const urgentRows = urgentCandidateRows
      .filter((row) => isUrgentPendingShift(row, calendar.today, now))
      .sort(compareShiftsByStartThenCentre);
    const totalUrgentPendingCount = urgentRows.length;
    const urgentPendingShifts = urgentRows
      .slice(0, DASHBOARD_URGENT_PENDING_LIMIT)
      .map((row) => mapUrgentPendingItem(row, now));

    const next7Counts = countsFromStatusRows(next7StatusRows);
    const sortedNext7Pending = [...next7PendingCandidateRows].sort(compareShiftsByStartThenCentre);
    const totalPendingCount = sortedNext7Pending.length;

    return {
      generatedAt: now.toISOString(),
      timezone: DASHBOARD_TIMEZONE,
      today: {
        date: calendar.today,
        ...todayCounts,
        shifts: todayShifts,
        hasMoreShifts: sortedTodayRows.length > DASHBOARD_TODAY_SHIFTS_LIMIT,
      },
      attention: {
        urgentPendingShifts,
        totalUrgentPendingCount,
        hasMoreUrgentPending: totalUrgentPendingCount > DASHBOARD_URGENT_PENDING_LIMIT,
        documents: {
          pendingReview: documents.pendingReview,
          issueFlagged: documents.issueFlagged,
          expired: documents.expired,
        },
        communications: communicationFailures,
      },
      next7Days: {
        dateFrom: calendar.next7DaysFrom,
        dateTo: calendar.next7DaysTo,
        ...next7Counts,
        fillRate: computeFillRatePercent(
          next7Counts.filled,
          next7Counts.completed,
          next7Counts.pending,
        ),
        pendingShifts: sortedNext7Pending
          .slice(0, DASHBOARD_NEXT7_PENDING_LIMIT)
          .map(mapNext7PendingItem),
        totalPendingCount,
        hasMorePendingShifts: totalPendingCount > DASHBOARD_NEXT7_PENDING_LIMIT,
      },
      documents,
      staffReadiness,
      recentActivity: recentActivityResponse.items,
    };
  }

  private async loadStatusCountsForDate(
    shiftDate: string,
  ): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db
      .select({ status: shifts.status, count: count() })
      .from(shifts)
      .where(eq(shifts.shiftDate, shiftDate))
      .groupBy(shifts.status);
    return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  private async loadStatusCountsForDateRange(
    dateFrom: string,
    dateTo: string,
  ): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db
      .select({ status: shifts.status, count: count() })
      .from(shifts)
      .where(and(gte(shifts.shiftDate, dateFrom), lte(shifts.shiftDate, dateTo)))
      .groupBy(shifts.status);
    return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  private shiftSelectQuery() {
    return this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        centreId: shifts.centreId,
        centreName: centres.name,
        assignedStaffId: shifts.assignedStaffId,
        assignedLegalName: staff.legalName,
        assignedDisplayName: staff.displayName,
        assignedUseDisplayName: staff.useDisplayName,
      })
      .from(shifts)
      .innerJoin(centres, eq(shifts.centreId, centres.id))
      .leftJoin(staff, eq(shifts.assignedStaffId, staff.id));
  }

  private async loadShiftRowsForDate(shiftDate: string): Promise<ShiftRow[]> {
    return this.shiftSelectQuery().where(eq(shifts.shiftDate, shiftDate));
  }

  private async loadPendingShiftRowsInDateRange(
    dateFrom: string,
    dateTo: string,
  ): Promise<ShiftRow[]> {
    return this.shiftSelectQuery().where(
      and(
        eq(shifts.status, 'pending'),
        gte(shifts.shiftDate, dateFrom),
        lte(shifts.shiftDate, dateTo),
      ),
    );
  }

  private async loadStaffReadiness(): Promise<DashboardStaffReadiness> {
    const rows = await this.db
      .select({
        staffId: staff.id,
        account: staffAccounts,
      })
      .from(staff)
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(staff.status, 'active'));

    const readiness: DashboardStaffReadiness = {
      activeStaff: rows.length,
      portalActive: 0,
      noAccount: 0,
      invited: 0,
      incomplete: 0,
      disabled: 0,
    };

    for (const row of rows) {
      const status = resolvePortalAccountDisplayStatus(row.account ?? null);
      if (status === 'active') readiness.portalActive += 1;
      if (status === 'no_account') readiness.noAccount += 1;
      if (status === 'invited') readiness.invited += 1;
      if (status === 'incomplete') readiness.incomplete += 1;
      if (status === 'disabled') readiness.disabled += 1;
    }

    return readiness;
  }

  private async loadCommunicationFailures(): Promise<{
    failedAssignmentConfirmations: number;
    failedAutomatedCommunications: number;
    totalFailures: number;
    recentFailures: DashboardCommunicationFailureItem[];
  }> {
    const [assignmentCountRow] = await this.db
      .select({ count: count() })
      .from(shiftAssignmentNotifications)
      .where(eq(shiftAssignmentNotifications.status, 'failed'));

    const [automatedCountRow] = await this.db
      .select({ count: count() })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.status, 'failed'),
          sql`${scheduledCommunications.communicationType} NOT LIKE 'test_%'`,
        ),
      );

    const failedAssignmentConfirmations = Number(assignmentCountRow?.count ?? 0);
    const failedAutomatedCommunications = Number(automatedCountRow?.count ?? 0);
    const totalFailures = failedAssignmentConfirmations + failedAutomatedCommunications;

    const recentFailures = await this.loadRecentCommunicationFailures();

    return {
      failedAssignmentConfirmations,
      failedAutomatedCommunications,
      totalFailures,
      recentFailures,
    };
  }

  private async loadRecentCommunicationFailures(): Promise<DashboardCommunicationFailureItem[]> {
    const assignmentRows = await this.db
      .select({
        occurredAt: sql<string>`COALESCE(${shiftAssignmentNotifications.sentAt}, ${shiftAssignmentNotifications.createdAt})`,
        shiftId: shiftAssignmentNotifications.shiftId,
        centreId: shifts.centreId,
        centreName: centres.name,
        staffId: shiftAssignmentNotifications.assignedStaffId,
        staffLegalName: staff.legalName,
        staffDisplayName: staff.displayName,
        staffUseDisplayName: staff.useDisplayName,
      })
      .from(shiftAssignmentNotifications)
      .leftJoin(shifts, eq(shifts.id, shiftAssignmentNotifications.shiftId))
      .leftJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(staff, eq(staff.id, shiftAssignmentNotifications.assignedStaffId))
      .where(eq(shiftAssignmentNotifications.status, 'failed'))
      .orderBy(
        sql`COALESCE(${shiftAssignmentNotifications.sentAt}, ${shiftAssignmentNotifications.createdAt}) DESC`,
      )
      .limit(DASHBOARD_RECENT_FAILURES_LIMIT);

    const automatedRows = await this.db
      .select({
        occurredAt: scheduledCommunications.updatedAt,
        communicationType: scheduledCommunications.communicationType,
        shiftId: sql<string | null>`CASE WHEN ${scheduledCommunications.entityType} = 'shift' THEN ${scheduledCommunications.entityId}::text ELSE NULL END`,
        centreId: shifts.centreId,
        centreName: centres.name,
        staffId: shifts.assignedStaffId,
        staffLegalName: staff.legalName,
        staffDisplayName: staff.displayName,
        staffUseDisplayName: staff.useDisplayName,
      })
      .from(scheduledCommunications)
      .leftJoin(
        shifts,
        and(
          eq(scheduledCommunications.entityType, 'shift'),
          eq(shifts.id, scheduledCommunications.entityId),
        ),
      )
      .leftJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(staff, eq(staff.id, shifts.assignedStaffId))
      .where(
        and(
          eq(scheduledCommunications.status, 'failed'),
          sql`${scheduledCommunications.communicationType} NOT LIKE 'test_%'`,
        ),
      )
      .orderBy(sql`${scheduledCommunications.updatedAt} DESC`)
      .limit(DASHBOARD_RECENT_FAILURES_LIMIT);

    const merged: DashboardCommunicationFailureItem[] = [
      ...assignmentRows.map((row) => ({
        type: 'assignment_confirmation' as const,
        occurredAt: new Date(row.occurredAt).toISOString(),
        shiftId: row.shiftId,
        centreId: row.centreId ?? null,
        centreName: row.centreName ?? null,
        staffId: row.staffId ?? null,
        staffName: row.staffId
          ? formatStaffReportName({
              legalName: row.staffLegalName ?? '',
              displayName: row.staffDisplayName ?? '',
              useDisplayName: row.staffUseDisplayName ?? false,
            })
          : null,
        communicationType: null,
      })),
      ...automatedRows.map((row) => ({
        type: 'automated_communication' as const,
        occurredAt: new Date(row.occurredAt).toISOString(),
        shiftId: row.shiftId,
        centreId: row.centreId ?? null,
        centreName: row.centreName ?? null,
        staffId: row.staffId ?? null,
        staffName: row.staffId
          ? formatStaffReportName({
              legalName: row.staffLegalName ?? '',
              displayName: row.staffDisplayName ?? '',
              useDisplayName: row.staffUseDisplayName ?? false,
            })
          : null,
        communicationType: row.communicationType,
      })),
    ];

    return merged
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, DASHBOARD_RECENT_FAILURES_LIMIT);
  }
}
