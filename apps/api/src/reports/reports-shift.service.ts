import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts } from '../db/schema';
import type { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import { resolveReportDateRange } from './report-date.util';
import { scheduledShiftDurationMinutesSql } from './report-duration.sql';
import { computeFillRatePercent } from './report-percentage.util';
import { ReportsService } from './reports.service';
import type {
  CentreUsageResponse,
  CentreUsageRow,
  ShiftFulfillmentResponse,
} from './types/shift-report.types';

type StatusCounts = {
  total: number;
  pending: number;
  filled: number;
  completed: number;
  cancelled: number;
};

function toSummary(counts: StatusCounts) {
  return {
    ...counts,
    fillRatePercent: computeFillRatePercent(counts.filled, counts.completed, counts.pending),
  };
}

@Injectable()
export class ReportsShiftService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reports: ReportsService,
  ) {}

  async getShiftFulfillment(query: ShiftReportQueryDto): Promise<ShiftFulfillmentResponse> {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreId = query.centreId ?? null;

    if (centreId) {
      await this.reports.assertCentreExists(centreId);
    }

    const conditions = [gte(shifts.shiftDate, dateFrom), lte(shifts.shiftDate, dateTo)];
    if (centreId) {
      conditions.push(eq(shifts.centreId, centreId));
    }

    const [counts] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${shifts.status} = 'pending')::int`,
        filled: sql<number>`count(*) filter (where ${shifts.status} = 'filled')::int`,
        completed: sql<number>`count(*) filter (where ${shifts.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${shifts.status} = 'cancelled')::int`,
      })
      .from(shifts)
      .where(and(...conditions));

    let centreName: string | null = null;
    if (centreId) {
      const [centre] = await this.db
        .select({ name: centres.name })
        .from(centres)
        .where(eq(centres.id, centreId))
        .limit(1);
      centreName = centre?.name ?? null;
    }

    const row = counts ?? {
      total: 0,
      pending: 0,
      filled: 0,
      completed: 0,
      cancelled: 0,
    };

    return {
      dateFrom,
      dateTo,
      centreId,
      centreName,
      summary: toSummary(row),
    };
  }

  async getCentreUsage(query: ShiftReportQueryDto): Promise<CentreUsageResponse> {
    const { dateFrom, dateTo } = resolveReportDateRange(query.dateFrom, query.dateTo);
    const centreId = query.centreId ?? null;

    if (centreId) {
      await this.reports.assertCentreExists(centreId);
    }

    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
    const shiftJoin = and(
      eq(shifts.centreId, centres.id),
      gte(shifts.shiftDate, dateFrom),
      lte(shifts.shiftDate, dateTo),
    );

    const centreConditions = centreId ? eq(centres.id, centreId) : undefined;

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

    const rows: CentreUsageRow[] = rawRows.map((row) => ({
      centreId: row.centreId,
      centreName: row.centreName,
      totalShifts: row.totalShifts,
      pending: row.pending,
      filled: row.filled,
      completed: row.completed,
      cancelled: row.cancelled,
      fillRatePercent: computeFillRatePercent(row.filled, row.completed, row.pending),
      totalScheduledMinutes: row.totalScheduledMinutes,
      completedScheduledMinutes: row.completedScheduledMinutes,
    }));

    const summary = rows.reduce(
      (acc, row) => ({
        totalCentres: acc.totalCentres + 1,
        totalShifts: acc.totalShifts + row.totalShifts,
        totalScheduledMinutes: acc.totalScheduledMinutes + row.totalScheduledMinutes,
        totalCompletedScheduledMinutes:
          acc.totalCompletedScheduledMinutes + row.completedScheduledMinutes,
      }),
      {
        totalCentres: 0,
        totalShifts: 0,
        totalScheduledMinutes: 0,
        totalCompletedScheduledMinutes: 0,
      },
    );

    return {
      dateFrom,
      dateTo,
      centreId,
      summary,
      rows,
    };
  }
}
