import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staff } from '../db/schema';
import type { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import type { CentreUsageShiftsQueryDto } from './dto/centre-usage-shifts-query.dto';
import type { SupportedCity } from '@intra/shared';
import { resolveCentreUsageCentreIds } from './dto/report-centre-ids.util';
import { resolveReportCitiesFilter } from './dto/report-cities.util';
import type { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import {
  buildCentreUsageSummaryFromRows,
  buildShiftFulfillmentSummaryFromRows,
  centreRowMatchesScheduledHoursFilters,
  centreRowMatchesShiftMetricFilters,
  resolveCentreScheduledHoursFilters,
  resolveCentreShiftMetricFilters,
  toCentreUsageRow,
  toShiftFulfillmentRow,
  type CentreMetricsFullRow,
} from './report-centre-comparison.util';
import { paginateReportRows, parseComparisonReportPagination } from './report-comparison-pagination.util';
import { resolveReportDateRange } from './report-date.util';
import { scheduledShiftDurationMinutesSql } from './report-duration.sql';
import { normalizeReportCount, normalizeReportScheduledMinutes } from './report-minutes.util';
import { computeFillRatePercent } from './report-percentage.util';
import { formatStaffReportName, formatStaffReportRole } from './report-staff-name.util';
import {
  formatReportShiftStatusLabel,
  resolveCentreUsageShiftDetailStatus,
  type ReportShiftStatus,
} from './report-shift-status.util';
import { ReportsService } from './reports.service';
import type {
  CentreUsageResponse,
  CentreUsageRow,
  CentreUsageShiftsResponse,
  ShiftFulfillmentResponse,
} from './types/shift-report.types';

@Injectable()
export class ReportsShiftService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reports: ReportsService,
  ) {}

  async getShiftFulfillment(query: ShiftReportQueryDto): Promise<ShiftFulfillmentResponse> {
    const { dateFrom, dateTo, centreIds, filteredRows, metricFilters } =
      await this.resolveShiftFulfillmentFilteredRows(query);
    const { page, pageSize } = parseComparisonReportPagination(query);
    const summary = buildShiftFulfillmentSummaryFromRows(filteredRows);
    const paginated = paginateReportRows(filteredRows, page, pageSize);

    const legacyCentreId = query.centreId ?? null;
    let centreName: string | null = null;
    if (legacyCentreId) {
      centreName = filteredRows.find((row) => row.centreId === legacyCentreId)?.centreName ?? null;
      if (!centreName && centreIds?.length === 1) {
        const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds);
        centreName = allRows.find((row) => row.centreId === centreIds[0])?.centreName ?? null;
      }
    } else if (centreIds?.length === 1) {
      const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds);
      centreName = allRows.find((row) => row.centreId === centreIds[0])?.centreName ?? null;
    }

    return {
      dateFrom,
      dateTo,
      centreIds,
      centreId: legacyCentreId ?? (centreIds?.length === 1 ? centreIds[0]! : null),
      centreName,
      summary,
      rows: paginated.items.map(toShiftFulfillmentRow),
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalCount: paginated.totalCount,
      hasMore: paginated.hasMore,
    };
  }

  async getCentreUsage(query: CentreUsageQueryDto): Promise<CentreUsageResponse> {
    const { dateFrom, dateTo, centreIds, filteredRows } =
      await this.resolveCentreUsageFilteredRows(query);
    const { page, pageSize } = parseComparisonReportPagination(query);
    const summary = buildCentreUsageSummaryFromRows(filteredRows);
    const paginated = paginateReportRows(filteredRows, page, pageSize);

    return {
      dateFrom,
      dateTo,
      centreIds,
      summary,
      rows: paginated.items.map(toCentreUsageRow),
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalCount: paginated.totalCount,
      hasMore: paginated.hasMore,
    };
  }

  /** Full filtered centre rows for shift fulfillment export (ignores pagination). */
  async getShiftFulfillmentExportRows(query: ShiftReportQueryDto) {
    const resolved = await this.resolveShiftFulfillmentFilteredRows(query);
    return {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      rows: resolved.filteredRows.map(toShiftFulfillmentRow),
    };
  }

  /** Full filtered centre rows for centre usage export (ignores pagination). */
  async getCentreUsageExportRows(query: CentreUsageQueryDto) {
    const resolved = await this.resolveCentreUsageFilteredRows(query);
    return {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      rows: resolved.filteredRows.map(toCentreUsageRow),
    };
  }

  async getCentreUsageShifts(query: CentreUsageShiftsQueryDto): Promise<CentreUsageShiftsResponse> {
    const resolved = await this.resolveCentreUsageShiftsQuery(query);
    const { page, pageSize, offset } = parseComparisonReportPagination(query);

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(resolved.whereClause);

    const rawRows = await this.db
      .select({
        shiftId: shifts.id,
        shiftDate: shifts.shiftDate,
        centreId: shifts.centreId,
        centreName: centres.name,
        staffId: shifts.assignedStaffId,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        scheduledMinutes: resolved.durationMinutes,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(staff, eq(staff.id, shifts.assignedStaffId))
      .where(resolved.whereClause)
      .orderBy(asc(centres.name), asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id))
      .limit(pageSize)
      .offset(offset);

    const totalCount = normalizeReportCount(countRow?.total ?? 0);
    const rows = rawRows.map((row) => ({
      shiftId: row.shiftId,
      shiftDate: String(row.shiftDate),
      centreId: row.centreId,
      centreName: row.centreName,
      staffId: row.staffId,
      staffName: row.staffId
        ? formatStaffReportName({
            legalName: row.legalName!,
            displayName: row.displayName ?? '',
            useDisplayName: row.useDisplayName ?? false,
          })
        : 'Unassigned',
      role: formatStaffReportRole(row.roleNeeded),
      status: row.status as ReportShiftStatus,
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      scheduledMinutes: normalizeReportScheduledMinutes(row.scheduledMinutes),
    }));

    return {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      centreIds: resolved.centreIds,
      status: resolved.status,
      staffIds: resolved.staffIds,
      summary: resolved.summary,
      rows,
      page,
      pageSize,
      totalCount,
      hasMore: page * pageSize < totalCount,
    };
  }

  /** Full filtered shift rows for centre usage shift detail export (ignores pagination). */
  async getCentreUsageShiftsExportRows(query: CentreUsageShiftsQueryDto) {
    const resolved = await this.resolveCentreUsageShiftsQuery(query);

    const rawRows = await this.db
      .select({
        shiftId: shifts.id,
        shiftDate: shifts.shiftDate,
        centreName: centres.name,
        staffId: shifts.assignedStaffId,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        scheduledMinutes: resolved.durationMinutes,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(staff, eq(staff.id, shifts.assignedStaffId))
      .where(resolved.whereClause)
      .orderBy(asc(centres.name), asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));

    const rows = rawRows.map((row) => ({
      shiftId: row.shiftId,
      shiftDate: String(row.shiftDate),
      centreName: row.centreName,
      staffName: row.staffId
        ? formatStaffReportName({
            legalName: row.legalName!,
            displayName: row.displayName ?? '',
            useDisplayName: row.useDisplayName ?? false,
          })
        : 'Unassigned',
      role: formatStaffReportRole(row.roleNeeded),
      statusLabel: formatReportShiftStatusLabel(row.status as ReportShiftStatus),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      scheduledMinutes: normalizeReportScheduledMinutes(row.scheduledMinutes),
    }));

    return {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      rows,
    };
  }

  private async resolveCentreUsageShiftsQuery(query: CentreUsageShiftsQueryDto) {
    const centreIds = resolveCentreUsageCentreIds({ centreIds: query.centreIds });
    if (!centreIds?.length) {
      throw new BadRequestException('At least one centre ID is required.');
    }

    await this.reports.assertCentresExist(centreIds);

    const cities = resolveReportCitiesFilter(query.cities);
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const status = resolveCentreUsageShiftDetailStatus(query.status);
    const staffIds = query.staffIds?.length ? [...new Set(query.staffIds)] : null;
    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);

    const conditions = [
      inArray(shifts.centreId, centreIds),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    ];

    if (cities?.length) {
      conditions.push(inArray(centres.city, cities));
    }

    if (status !== 'all') {
      conditions.push(eq(shifts.status, status));
    }

    if (staffIds?.length) {
      conditions.push(inArray(shifts.assignedStaffId, staffIds));
    }

    const whereClause = and(...conditions)!;

    const [summaryRow] = await this.db
      .select({
        totalShifts: sql<number>`count(*)::int`,
        totalScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}), 0)::int`,
        uniqueStaff: sql<number>`count(distinct ${shifts.assignedStaffId}) filter (where ${shifts.assignedStaffId} is not null)::int`,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(whereClause);

    return {
      dateFrom,
      dateTo,
      centreIds,
      status,
      staffIds,
      whereClause,
      durationMinutes,
      summary: {
        totalShifts: normalizeReportCount(summaryRow?.totalShifts ?? 0),
        totalScheduledMinutes: normalizeReportScheduledMinutes(
          summaryRow?.totalScheduledMinutes ?? 0,
        ),
        uniqueStaff: normalizeReportCount(summaryRow?.uniqueStaff ?? 0),
      },
    };
  }

  private async resolveShiftFulfillmentFilteredRows(query: ShiftReportQueryDto) {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreIds = resolveCentreUsageCentreIds(query);
    const cities = resolveReportCitiesFilter(query.cities);
    const metricFilters = resolveCentreShiftMetricFilters(query);

    if (centreIds?.length) {
      await this.reports.assertCentresExist(centreIds);
    }

    const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds, cities);
    const filteredRows = allRows.filter((row) => centreRowMatchesShiftMetricFilters(row, metricFilters));

    return { dateFrom, dateTo, centreIds, cities, filteredRows, metricFilters };
  }

  private async resolveCentreUsageFilteredRows(query: CentreUsageQueryDto) {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreIds = resolveCentreUsageCentreIds(query);
    const cities = resolveReportCitiesFilter(query.cities);
    const metricFilters = resolveCentreShiftMetricFilters(query);
    const hoursFilters = resolveCentreScheduledHoursFilters(query);

    if (centreIds?.length) {
      await this.reports.assertCentresExist(centreIds);
    }

    const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds, cities);
    const filteredRows = allRows.filter(
      (row) =>
        centreRowMatchesShiftMetricFilters(row, metricFilters) &&
        centreRowMatchesScheduledHoursFilters(row, hoursFilters),
    );

    return { dateFrom, dateTo, centreIds, cities, filteredRows };
  }

  private buildCentreScopeConditions(
    centreIds: string[] | null,
    cities: SupportedCity[] | null,
  ) {
    const parts = [];
    if (centreIds?.length) {
      parts.push(inArray(centres.id, centreIds));
    }
    if (cities?.length) {
      parts.push(inArray(centres.city, cities));
    }
    return parts.length ? and(...parts) : undefined;
  }

  private async fetchCentreMetricsRows(
    dateFrom: string,
    dateTo: string,
    centreIds: string[] | null,
    cities: SupportedCity[] | null = null,
  ): Promise<CentreMetricsFullRow[]> {
    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
    const shiftJoin = and(
      eq(shifts.centreId, centres.id),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    );

    const centreConditions = this.buildCentreScopeConditions(centreIds, cities);

    const rawRows = await this.db
      .select({
        centreId: centres.id,
        centreName: centres.name,
        totalShifts: sql<number>`count(${shifts.id})::int`,
        pending: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'pending')::int`,
        filled: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'filled')::int`,
        completed: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'completed')::int`,
        cancelled: sql<number>`count(${shifts.id}) filter (where ${shifts.status} = 'cancelled')::int`,
        totalScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}), 0)::int`,
        completedScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}) filter (where ${shifts.status} = 'completed'), 0)::int`,
      })
      .from(centres)
      .leftJoin(shifts, shiftJoin)
      .where(centreConditions)
      .groupBy(centres.id, centres.name)
      .orderBy(desc(sql`count(${shifts.id})`), asc(centres.name));

    return rawRows.map((row) => {
      const filled = normalizeReportCount(row.filled);
      const completed = normalizeReportCount(row.completed);
      const pending = normalizeReportCount(row.pending);

      return {
        centreId: row.centreId,
        centreName: row.centreName,
        totalShifts: normalizeReportCount(row.totalShifts),
        pending,
        filled,
        completed,
        cancelled: normalizeReportCount(row.cancelled),
        fillRatePercent: computeFillRatePercent(filled, completed, pending),
        totalScheduledMinutes: normalizeReportScheduledMinutes(row.totalScheduledMinutes),
        completedScheduledMinutes: normalizeReportScheduledMinutes(row.completedScheduledMinutes),
      };
    });
  }
}
