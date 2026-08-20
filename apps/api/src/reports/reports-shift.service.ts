import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts } from '../db/schema';
import type { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import { resolveCentreUsageCentreIds } from './dto/report-centre-ids.util';
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
import { ReportsService } from './reports.service';
import type {
  CentreUsageResponse,
  CentreUsageRow,
  ShiftFulfillmentResponse,
} from './types/shift-report.types';

@Injectable()
export class ReportsShiftService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reports: ReportsService,
  ) {}

  async getShiftFulfillment(query: ShiftReportQueryDto): Promise<ShiftFulfillmentResponse> {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreIds = resolveCentreUsageCentreIds(query);
    const { page, pageSize } = parseComparisonReportPagination(query);
    const metricFilters = resolveCentreShiftMetricFilters(query);

    if (centreIds?.length) {
      await this.reports.assertCentresExist(centreIds);
    }

    const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds);
    const filteredRows = allRows.filter((row) => centreRowMatchesShiftMetricFilters(row, metricFilters));
    const summary = buildShiftFulfillmentSummaryFromRows(filteredRows);
    const paginated = paginateReportRows(filteredRows, page, pageSize);

    const legacyCentreId = query.centreId ?? null;
    let centreName: string | null = null;
    if (legacyCentreId) {
      centreName = filteredRows.find((row) => row.centreId === legacyCentreId)?.centreName ?? null;
      if (!centreName && centreIds?.length === 1) {
        centreName = allRows.find((row) => row.centreId === centreIds[0])?.centreName ?? null;
      }
    } else if (centreIds?.length === 1) {
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
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreIds = resolveCentreUsageCentreIds(query);
    const { page, pageSize } = parseComparisonReportPagination(query);
    const metricFilters = resolveCentreShiftMetricFilters(query);
    const hoursFilters = resolveCentreScheduledHoursFilters(query);

    if (centreIds?.length) {
      await this.reports.assertCentresExist(centreIds);
    }

    const allRows = await this.fetchCentreMetricsRows(dateFrom, dateTo, centreIds);
    const filteredRows = allRows.filter(
      (row) =>
        centreRowMatchesShiftMetricFilters(row, metricFilters) &&
        centreRowMatchesScheduledHoursFilters(row, hoursFilters),
    );
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

  private async fetchCentreMetricsRows(
    dateFrom: string,
    dateTo: string,
    centreIds: string[] | null,
  ): Promise<CentreMetricsFullRow[]> {
    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
    const shiftJoin = and(
      eq(shifts.centreId, centres.id),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    );

    const centreConditions = centreIds?.length ? inArray(centres.id, centreIds) : undefined;

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
