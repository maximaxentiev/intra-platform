import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staff } from '../db/schema';
import type { StaffUsageQueryDto } from './dto/staff-usage-query.dto';
import type { StaffUsageShiftsQueryDto } from './dto/staff-usage-shifts-query.dto';
import { resolveStaffUsageStaffIds } from './dto/report-staff-ids.util';
import { paginateReportRows, parseComparisonReportPagination } from './report-comparison-pagination.util';
import { resolveReportDateRange } from './report-date.util';
import { scheduledShiftDurationMinutesSql } from './report-duration.sql';
import { normalizeReportCount, normalizeReportScheduledMinutes } from './report-minutes.util';
import {
  buildPaginatedReportResponse,
  parseReportPagination,
} from './report-pagination.util';
import {
  buildStaffUsageSummaryFromRows,
  resolveStaffUsageMetricFilters,
  staffRowMatchesMetricFilters,
} from './report-staff-comparison.util';
import { formatStaffReportName, formatStaffReportRole } from './report-staff-name.util';
import { ReportsService } from './reports.service';
import type {
  StaffUsageResponse,
  StaffUsageRow,
  StaffUsageShiftsResponse,
} from './types/staff-report.types';

@Injectable()
export class ReportsStaffService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reports: ReportsService,
  ) {}

  async getStaffUsage(query: StaffUsageQueryDto): Promise<StaffUsageResponse> {
    const { dateFrom, dateTo, staffIds, filteredRows } = await this.resolveStaffUsageFilteredRows(query);
    const { page, pageSize } = parseComparisonReportPagination(query);
    const summary = buildStaffUsageSummaryFromRows(filteredRows);
    const paginated = paginateReportRows(filteredRows, page, pageSize);

    return {
      dateFrom,
      dateTo,
      staffIds,
      summary,
      rows: paginated.items,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalCount: paginated.totalCount,
      hasMore: paginated.hasMore,
    };
  }

  async getStaffUsageExportRows(query: StaffUsageQueryDto) {
    const { dateFrom, dateTo, filteredRows } = await this.resolveStaffUsageFilteredRows(query);
    return { dateFrom, dateTo, rows: filteredRows };
  }

  private async resolveStaffUsageFilteredRows(query: StaffUsageQueryDto) {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const staffIds = resolveStaffUsageStaffIds(query);
    const metricFilters = resolveStaffUsageMetricFilters(query);

    if (staffIds?.length) {
      await this.reports.assertStaffMembersExist(staffIds);
    }

    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
    const shiftJoin = and(
      eq(shifts.assignedStaffId, staff.id),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    );

    const staffConditions = this.buildStaffConditions(staffIds, query.roles);

    const rawRows = await this.db
      .select({
        staffId: staff.id,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        role: staff.role,
        completedShifts: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'completed')::int`,
        filledShifts: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'filled')::int`,
        completedScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}) filter (where ${shifts.status} = 'completed'), 0)::int`,
        filledScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}) filter (where ${shifts.status} = 'filled'), 0)::int`,
      })
      .from(staff)
      .leftJoin(shifts, shiftJoin)
      .where(staffConditions)
      .groupBy(
        staff.id,
        staff.legalName,
        staff.displayName,
        staff.useDisplayName,
        staff.role,
      )
      .orderBy(
        desc(sql`count(${shifts.id}) filter (where ${shifts.status} = 'completed')`),
        desc(
          sql`coalesce(sum(${durationMinutes}) filter (where ${shifts.status} = 'completed'), 0)`,
        ),
        asc(staff.legalName),
      );

    const allRows: StaffUsageRow[] = rawRows.map((row) => ({
      staffId: row.staffId,
      staffName: formatStaffReportName(row),
      role: formatStaffReportRole(row.role),
      completedShifts: normalizeReportCount(row.completedShifts),
      filledShifts: normalizeReportCount(row.filledShifts),
      completedScheduledMinutes: normalizeReportScheduledMinutes(row.completedScheduledMinutes),
      filledScheduledMinutes: normalizeReportScheduledMinutes(row.filledScheduledMinutes),
    }));

    const filteredRows = allRows.filter((row) => staffRowMatchesMetricFilters(row, metricFilters));
    return { dateFrom, dateTo, staffIds, filteredRows };
  }

  private buildStaffConditions(staffIds: string[] | null, roles?: string[]) {
    const conditions = [];

    if (staffIds?.length) {
      conditions.push(inArray(staff.id, staffIds));
    }

    if (roles?.length) {
      conditions.push(inArray(staff.role, roles));
    }

    return conditions.length ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  }

  async getStaffUsageShifts(
    staffId: string,
    query: StaffUsageShiftsQueryDto,
  ): Promise<StaffUsageShiftsResponse> {
    await this.reports.assertStaffExists(staffId);

    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const { page, pageSize, offset } = parseReportPagination(query);
    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);

    const conditions = and(
      eq(shifts.assignedStaffId, staffId),
      eq(shifts.status, 'completed'),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    );

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(shifts)
      .where(conditions);

    const rawRows = await this.db
      .select({
        shiftId: shifts.id,
        shiftDate: shifts.shiftDate,
        centreName: centres.name,
        roleNeeded: shifts.roleNeeded,
        scheduledStartTime: shifts.startTime,
        scheduledEndTime: shifts.endTime,
        scheduledMinutes: durationMinutes,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(conditions)
      .orderBy(desc(shifts.shiftDate), desc(shifts.startTime), asc(shifts.id))
      .limit(pageSize)
      .offset(offset);

    const totalCount = normalizeReportCount(countRow?.total ?? 0);
    const items = rawRows.map((row) => ({
      shiftId: row.shiftId,
      shiftDate: String(row.shiftDate),
      centreName: row.centreName,
      role: formatStaffReportRole(row.roleNeeded),
      scheduledStartTime: String(row.scheduledStartTime),
      scheduledEndTime: String(row.scheduledEndTime),
      scheduledMinutes: normalizeReportScheduledMinutes(row.scheduledMinutes),
    }));

    return {
      dateFrom,
      dateTo,
      staffId,
      ...buildPaginatedReportResponse(items, page, pageSize, totalCount),
    };
  }
}
