import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts, staff } from '../db/schema';
import { ReportsService } from './reports.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsActivityService } from './reports-activity.service';
import { ReportsExportService } from './reports-export.service';
import { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import { scheduledShiftDurationMinutesSql } from './report-duration.sql';
import { normalizeReportScheduledMinutes } from './report-minutes.util';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();

function csvDataRowCount(content: string): number {
  const lines = content.replace(/^\uFEFF/, '').trimEnd().split('\n');
  return Math.max(0, lines.length - 1);
}

const FIXTURE = {
  centreA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  centreB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  centreC: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  staffMember: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  anchorDate: '2026-08-05',
};

describe.skipIf(!POSTGRES_READY)('Reports shift PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ReportsShiftService;
  let exportService: ReportsExportService;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    const reportsService = new ReportsService(db);
    service = new ReportsShiftService(db, reportsService);
    exportService = new ReportsExportService(
      service,
      new ReportsStaffService(db, reportsService),
      new ReportsDocumentsService(db, reportsService),
      new ReportsActivityService(db),
    );

    await db.insert(centres).values([
      { id: FIXTURE.centreA, name: 'Centre Alpha', city: 'Toronto' },
      { id: FIXTURE.centreB, name: 'Centre Beta', city: 'Toronto' },
      { id: FIXTURE.centreC, name: 'Centre Gamma', city: 'Toronto' },
    ]);

    await db.insert(staff).values({
      id: FIXTURE.staffMember,
      legalFirstName: 'Report',
      legalLastName: 'Tester',
      legalName: 'Report Tester',
      email: `${FIXTURE.staffMember}@example.test`,
      city: 'Toronto',
    });

    const anchor = {
      centreId: FIXTURE.centreA,
      shiftDate: FIXTURE.anchorDate,
      startTime: '09:00:00',
      endTime: '17:00:00',
    };

    const rows = await db
      .insert(shifts)
      .values([
        ...Array.from({ length: 2 }, () => ({ ...anchor, status: 'pending' as const })),
        ...Array.from({ length: 3 }, () => ({ ...anchor, status: 'filled' as const })),
        ...Array.from({ length: 4 }, () => ({ ...anchor, status: 'completed' as const })),
        { ...anchor, status: 'cancelled' as const },
        {
          ...anchor,
          status: 'cancelled' as const,
          assignedStaffId: FIXTURE.staffMember,
          cancellationReason: 'Carer unavailable',
        },
        {
          centreId: FIXTURE.centreB,
          shiftDate: '2026-08-10',
          startTime: '09:15:00',
          endTime: '16:45:00',
          status: 'completed',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-09-15',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
        },
      ])
      .returning({ id: shifts.id });

    shiftIds.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffMember));
    await db
      .delete(centres)
      .where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC]));
    await pool.end();
  });

  it('aggregates shift fulfillment with locked fill rate semantics', async () => {
    const result = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreA,
    });

    expect(result.summary.totalShifts).toBe(11);
    expect(result.summary.pending).toBe(2);
    expect(result.summary.filled).toBe(3);
    expect(result.summary.completed).toBe(4);
    expect(result.summary.cancelled).toBe(2);
    expect(result.summary.fillRatePercent).toBe(77.8);
  });

  it('counts cancelled-with-assignee in total/cancelled but not fill rate', async () => {
    const result = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreA,
    });

    expect(result.summary.cancelled).toBe(2);
    expect(result.summary.filled).toBe(3);
    expect(result.summary.completed).toBe(4);
    expect(result.summary.fillRatePercent).toBe(77.8);
  });

  it('returns null fill rate when no fillable shifts exist', async () => {
    const result = await service.getShiftFulfillment({
      dateFrom: '2026-08-20',
      dateTo: '2026-08-21',
    });
    expect(result.summary.totalShifts).toBe(0);
    expect(result.summary.fillRatePercent).toBeNull();
  });

  it('filters by centre and rejects nonexistent centre', async () => {
    const filtered = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreB,
    });
    expect(filtered.summary.totalShifts).toBe(1);
    expect(filtered.centreName).toBe('Centre Beta');

    await expect(
      service.getShiftFulfillment({
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('excludes shifts outside inclusive shift_date range', async () => {
    const result = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreA,
    });
    expect(result.summary.completed).toBe(4);
  });

  it('normalizes PostgreSQL aggregate minute values before returning DTOs', async () => {
    const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
    const shiftJoin = and(
      eq(shifts.centreId, centres.id),
      gte(shifts.shiftDate, FIXTURE.dateFrom),
      lte(shifts.shiftDate, FIXTURE.dateTo),
    );

    const [withShifts] = await db
      .select({
        totalScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}), 0)::int`,
      })
      .from(shifts)
      .where(eq(shifts.centreId, FIXTURE.centreB));

    const [zeroUsage] = await db
      .select({
        totalScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}), 0)::int`,
      })
      .from(centres)
      .leftJoin(shifts, shiftJoin)
      .where(eq(centres.id, FIXTURE.centreC))
      .groupBy(centres.id);

    expect(normalizeReportScheduledMinutes(withShifts!.totalScheduledMinutes)).toBe(450);
    expect(normalizeReportScheduledMinutes(zeroUsage!.totalScheduledMinutes)).toBe(0);
  });

  it('aggregates centre usage including zero-shift centres', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreIds: [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC],
      pageSize: 100,
    });

    const centreA = result.rows.find((r) => r.centreId === FIXTURE.centreA)!;
    const centreB = result.rows.find((r) => r.centreId === FIXTURE.centreB)!;
    const centreC = result.rows.find((r) => r.centreId === FIXTURE.centreC)!;

    expect(centreA.totalShifts).toBe(11);
    expect(centreA.pending).toBe(2);
    expect(centreA.filled).toBe(3);
    expect(centreA.completed).toBe(4);
    expect(centreA.cancelled).toBe(2);
    expect(centreA.fillRatePercent).toBe(77.8);
    expect(centreA.totalScheduledMinutes).toBe(11 * 480);
    expect(centreA.completedScheduledMinutes).toBe(4 * 480);

    expect(centreB.totalShifts).toBe(1);
    expect(centreB.completedScheduledMinutes).toBe(450);

    expect(centreC.totalShifts).toBe(0);
    expect(centreC.pending).toBe(0);
    expect(centreC.filled).toBe(0);
    expect(centreC.completed).toBe(0);
    expect(centreC.cancelled).toBe(0);
    expect(centreC.fillRatePercent).toBeNull();
    expect(centreC.totalScheduledMinutes).toBe(0);
    expect(centreC.completedScheduledMinutes).toBe(0);

    expect(result.rows[0]!.centreId).toBe(FIXTURE.centreA);
    expect(result.rows.some((r) => r.centreId === FIXTURE.centreC)).toBe(true);

    const fixtureRows = result.rows.filter((row) =>
      [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC].includes(row.centreId),
    );
    expect(fixtureRows).toHaveLength(3);

    const fixtureSummary = fixtureRows.reduce(
      (acc, row) => ({
        totalShifts: acc.totalShifts + row.totalShifts,
        totalScheduledMinutes: acc.totalScheduledMinutes + row.totalScheduledMinutes,
        totalCompletedScheduledMinutes:
          acc.totalCompletedScheduledMinutes + row.completedScheduledMinutes,
      }),
      { totalShifts: 0, totalScheduledMinutes: 0, totalCompletedScheduledMinutes: 0 },
    );
    expect(fixtureSummary.totalShifts).toBe(12);
    expect(fixtureSummary.totalScheduledMinutes).toBe(11 * 480 + 450);
    expect(fixtureSummary.totalCompletedScheduledMinutes).toBe(4 * 480 + 450);

    for (const row of fixtureRows) {
      expect(typeof row.totalScheduledMinutes).toBe('number');
      expect(typeof row.completedScheduledMinutes).toBe('number');
      expect(Number.isFinite(row.totalScheduledMinutes)).toBe(true);
      expect(Number.isFinite(row.completedScheduledMinutes)).toBe(true);
    }
    expect(typeof result.summary.totalScheduledMinutes).toBe('number');
    expect(typeof result.summary.totalCompletedScheduledMinutes).toBe('number');
    expect(Number.isFinite(result.summary.totalScheduledMinutes)).toBe(true);
    expect(Number.isFinite(result.summary.totalCompletedScheduledMinutes)).toBe(true);
  });

  it('returns zero minute aggregates for centres and summary in an empty range', async () => {
    const result = await service.getCentreUsage({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      centreIds: [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC],
      pageSize: 100,
    });

    expect(result.summary.totalShifts).toBeGreaterThanOrEqual(0);
    expect(result.summary.totalScheduledMinutes).toBeGreaterThanOrEqual(0);
    expect(result.summary.totalCompletedScheduledMinutes).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary.totalScheduledMinutes).toBe('number');
    expect(typeof result.summary.totalCompletedScheduledMinutes).toBe('number');

    const fixtureRows = result.rows.filter((row) =>
      [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC].includes(row.centreId),
    );
    expect(fixtureRows).toHaveLength(3);

    for (const row of fixtureRows) {
      expect(row.totalShifts).toBe(0);
      expect(row.totalScheduledMinutes).toBe(0);
      expect(row.completedScheduledMinutes).toBe(0);
      expect(typeof row.totalScheduledMinutes).toBe('number');
      expect(typeof row.completedScheduledMinutes).toBe('number');
    }
  });

  it('returns zero summary minutes for a centre with no shifts in range', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreC,
    });

    expect(result.summary.totalCentres).toBe(1);
    expect(result.summary.totalShifts).toBe(0);
    expect(result.summary.pending).toBe(0);
    expect(result.summary.filled).toBe(0);
    expect(result.summary.completed).toBe(0);
    expect(result.summary.cancelled).toBe(0);
    expect(result.summary.fillRatePercent).toBeNull();
    expect(result.summary.totalScheduledMinutes).toBe(0);
    expect(result.summary.totalCompletedScheduledMinutes).toBe(0);
    expect(result.centreIds).toEqual([FIXTURE.centreC]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.totalScheduledMinutes).toBe(0);
    expect(result.rows[0]!.completedScheduledMinutes).toBe(0);
    expect(typeof result.rows[0]!.totalScheduledMinutes).toBe('number');
  });

  it('filters centre usage by multiple centre IDs', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreIds: [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC],
    });

    expect(result.centreIds).toEqual([FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC]);
    expect(result.rows).toHaveLength(3);
    expect(result.summary.totalCentres).toBe(3);
    expect(result.summary.totalShifts).toBe(12);
    expect(typeof result.summary.pending).toBe('number');
    expect(typeof result.summary.fillRatePercent).toBe('number');
  });

  it('deduplicates repeated centre IDs in centre usage filter', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreIds: [FIXTURE.centreB, FIXTURE.centreB, FIXTURE.centreC],
    });

    expect(result.rows).toHaveLength(2);
    expect(result.summary.totalCentres).toBe(2);
  });

  it('supports legacy single centreId filter for centre usage', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreB,
    });

    expect(result.centreIds).toEqual([FIXTURE.centreB]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.centreId).toBe(FIXTURE.centreB);
  });

  it('rejects nonexistent centre IDs in centre usage filter', async () => {
    await expect(
      service.getCentreUsage({
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreIds: [FIXTURE.centreA, '00000000-0000-4000-8000-000000000099'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects malformed centreIds query values', () => {
    const dto = plainToInstance(CentreUsageQueryDto, { centreIds: 'not-a-uuid' });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'centreIds')).toBe(true);
  });

  it('keeps shift fulfillment unaffected after centre usage normalization', async () => {
    const result = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreA,
    });

    expect(result.summary.totalShifts).toBe(11);
    expect(result.summary.fillRatePercent).toBe(77.8);
  });

  it('defaults to current Toronto month when dates omitted', async () => {
    const result = await service.getShiftFulfillment({});
    expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-01$/);
    expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe('aggregate fill rate across selected centres', () => {
    const centreHigh = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
    const centreLow = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
    const fillRateShiftIds: string[] = [];

    beforeAll(async () => {
      await db.insert(centres).values([
        { id: centreHigh, name: 'Fill Rate High Centre', city: 'Toronto' },
        { id: centreLow, name: 'Fill Rate Low Centre', city: 'Toronto' },
      ]);

      const rows = await db
        .insert(shifts)
        .values([
          {
            centreId: centreHigh,
            shiftDate: '2026-08-12',
            startTime: '09:00:00',
            endTime: '17:00:00',
            status: 'filled',
          },
          ...Array.from({ length: 8 }, () => ({
            centreId: centreLow,
            shiftDate: '2026-08-12',
            startTime: '09:00:00',
            endTime: '17:00:00',
            status: 'pending' as const,
          })),
          {
            centreId: centreLow,
            shiftDate: '2026-08-12',
            startTime: '09:00:00',
            endTime: '17:00:00',
            status: 'filled',
          },
        ])
        .returning({ id: shifts.id });

      fillRateShiftIds.push(...rows.map((row) => row.id));
    });

    afterAll(async () => {
      if (fillRateShiftIds.length > 0) {
        await db.delete(shifts).where(inArray(shifts.id, fillRateShiftIds));
      }
      await db.delete(centres).where(inArray(centres.id, [centreHigh, centreLow]));
    });

    it('uses aggregate counts for fill rate instead of averaging centre percentages', async () => {
      const result = await service.getCentreUsage({
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreIds: [centreHigh, centreLow],
      });

      const high = result.rows.find((row) => row.centreId === centreHigh)!;
      const low = result.rows.find((row) => row.centreId === centreLow)!;

      expect(high.fillRatePercent).toBe(100);
      expect(low.fillRatePercent).toBe(11.1);
      expect(result.summary.filled).toBe(2);
      expect(result.summary.pending).toBe(8);
      expect(result.summary.fillRatePercent).toBe(20);
    });
  });

  describe('malformed legacy shift durations', () => {
    const malformedCentre = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
    const malformedShiftIds: string[] = [];

    beforeAll(async () => {
      await db.insert(centres).values({
        id: malformedCentre,
        name: 'Malformed Legacy Centre',
        city: 'Toronto',
      });

      const rows = await db
        .insert(shifts)
        .values([
          {
            centreId: malformedCentre,
            shiftDate: '2026-08-19',
            startTime: '21:00:00',
            endTime: '13:00:00',
            status: 'cancelled',
            assignedStaffId: FIXTURE.staffMember,
            cancellationReason: 'Carer unavailable',
          },
          {
            centreId: malformedCentre,
            shiftDate: '2026-08-19',
            startTime: '09:00:00',
            endTime: '17:00:00',
            status: 'pending',
          },
          {
            centreId: malformedCentre,
            shiftDate: '2026-08-20',
            startTime: '21:00:00',
            endTime: '13:00:00',
            status: 'completed',
          },
        ])
        .returning({ id: shifts.id });

      malformedShiftIds.push(...rows.map((row) => row.id));
    });

    afterAll(async () => {
      if (malformedShiftIds.length > 0) {
        await db.delete(shifts).where(inArray(shifts.id, malformedShiftIds));
      }
      await db.delete(centres).where(eq(centres.id, malformedCentre));
    });

    it('counts malformed cancelled shift but contributes zero scheduled minutes', async () => {
      const result = await service.getCentreUsage({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        centreIds: [malformedCentre],
      });

      const row = result.rows[0]!;
      expect(row.totalShifts).toBe(3);
      expect(row.cancelled).toBe(1);
      expect(row.pending).toBe(1);
      expect(row.completed).toBe(1);
      expect(row.totalScheduledMinutes).toBe(480);
      expect(row.completedScheduledMinutes).toBe(0);
      expect(typeof row.totalScheduledMinutes).toBe('number');
    });

    it('aggregates valid and invalid durations without error', async () => {
      const durationMinutes = scheduledShiftDurationMinutesSql(shifts.startTime, shifts.endTime);
      const [raw] = await db
        .select({
          totalScheduledMinutes: sql<number>`coalesce(sum(${durationMinutes}), 0)::int`,
        })
        .from(shifts)
        .where(eq(shifts.centreId, malformedCentre));

      expect(normalizeReportScheduledMinutes(raw!.totalScheduledMinutes)).toBe(480);
    });
  });

  describe('CSV export', () => {
    it('shift fulfillment export matches filtered totalCount and ignores pagination', async () => {
      const query = {
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreIds: [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC],
        pendingMin: 1,
        page: 2,
        pageSize: 1,
      };
      const json = await service.getShiftFulfillment(query);
      const csv = await exportService.exportShiftFulfillment(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(json.totalCount);
      expect(csv.filename).toBe('shift-fulfillment-2026-08-01-to-2026-08-31.csv');
      expect(csv.content).toContain('Centre,Total Shifts,Fill Rate (%)');
      expect(csv.content).toContain('Centre Alpha');
      expect(csv.content).not.toContain('storage_key');
    });

    it('centre usage export includes decimal scheduled hours and matches totalCount', async () => {
      const query = {
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreIds: [FIXTURE.centreA, FIXTURE.centreB, FIXTURE.centreC],
        scheduledHoursMin: 1,
        page: 1,
        pageSize: 1,
      };
      const json = await service.getCentreUsage(query);
      const csv = await exportService.exportCentreUsage(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(json.totalCount);
      expect(csv.filename).toBe('centre-usage-2026-08-01-to-2026-08-31.csv');
      expect(csv.content).toContain('Scheduled Hours');
      expect(csv.content).toContain('Scheduled Hours on Completed Shifts');
      expect(csv.content).toMatch(/Centre Beta,1,100,0,0,1,0,7\.5,7\.5/);
    });

    it('returns header-only CSV for zero matching shift fulfillment rows', async () => {
      const query = {
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        centreIds: [FIXTURE.centreA],
        pendingMin: 9999,
      };
      const json = await service.getShiftFulfillment(query);
      const csv = await exportService.exportShiftFulfillment(query);

      expect(json.totalCount).toBe(0);
      expect(csv.rowCount).toBe(0);
      expect(csvDataRowCount(csv.content)).toBe(0);
      expect(csv.content).toContain('Centre,Total Shifts');
    });
  });
});
