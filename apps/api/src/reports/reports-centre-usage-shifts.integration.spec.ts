import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts, staff } from '../db/schema';
import { ReportsService } from './reports.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsExportService } from './reports-export.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsActivityService } from './reports-activity.service';

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
  centreA: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1',
  centreB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba2',
  staffA: 'cccccccc-cccc-4ccc-8ccc-cccccccccca1',
  staffB: 'cccccccc-cccc-4ccc-8ccc-cccccccccca2',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
};

describe.skipIf(!POSTGRES_READY)('Reports centre usage shifts PostgreSQL integration', () => {
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

    await db.delete(shifts).where(inArray(shifts.centreId, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));

    await db.insert(centres).values([
      { id: FIXTURE.centreA, name: 'Alpha Centre', city: 'Toronto' },
      { id: FIXTURE.centreB, name: 'Beta Centre', city: 'Ottawa' },
    ]);

    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalFirstName: 'Alexandra',
        legalLastName: 'Morgan',
        legalName: 'Alexandra Morgan',
        displayName: 'Alex',
        useDisplayName: true,
        email: `${FIXTURE.staffA}@example.test`,
        city: 'Toronto',
        role: 'ECE',
      },
      {
        id: FIXTURE.staffB,
        legalFirstName: 'Robert',
        legalLastName: 'Beta',
        legalName: 'Robert Beta',
        displayName: 'Bobby',
        useDisplayName: true,
        email: `${FIXTURE.staffB}@example.test`,
        city: 'Toronto',
        role: 'ECA',
      },
    ]);

    const rows = await db
      .insert(shifts)
      .values([
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-05',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-06',
          startTime: '09:15:00',
          endTime: '16:45:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffB,
          roleNeeded: 'ECA',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-07',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'filled',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-08',
          startTime: '09:00:00',
          endTime: '08:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreB,
          shiftDate: '2026-08-05',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffB,
          roleNeeded: 'ECA',
        },
        {
          centreId: FIXTURE.centreB,
          shiftDate: '2026-08-09',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'pending',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-10',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'cancelled',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-09-01',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
      ])
      .returning({ id: shifts.id });

    shiftIds.push(...rows.map((row) => row.id));
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));
    await pool.end();
  });

  it('requires at least one centre ID', async () => {
    await expect(
      service.getCentreUsageShifts({
        centreIds: [],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
      }),
    ).rejects.toThrow(/At least one centre ID/i);
  });

  it('defaults to completed shifts for one centre', async () => {
    const result = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
    });

    expect(result.status).toBe('completed');
    expect(result.totalCount).toBe(3);
    expect(result.summary.totalShifts).toBe(3);
    expect(result.summary.uniqueStaff).toBe(2);
    expect(result.summary.totalScheduledMinutes).toBe(480 + 450 + 0);
    expect(result.rows.every((row) => row.status === 'completed')).toBe(true);
    expect(result.rows[0]!.role).toBe('ECE');
    expect(result.rows.some((row) => row.staffName === 'Alex')).toBe(true);
  });

  it('returns multiple centres ordered by centre name then date', async () => {
    const result = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA, FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'completed',
    });

    expect(result.totalCount).toBe(4);
    expect(result.rows[0]!.centreName).toBe('Alpha Centre');
    expect(result.rows[result.rows.length - 1]!.centreName).toBe('Beta Centre');
  });

  it('filters by filled, pending, cancelled, and all statuses', async () => {
    const filled = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'filled',
    });
    expect(filled.totalCount).toBe(1);
    expect(filled.rows[0]!.status).toBe('filled');

    const pending = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'pending',
    });
    expect(pending.totalCount).toBe(1);
    expect(pending.rows[0]!.staffName).toBe('Unassigned');

    const cancelled = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'cancelled',
    });
    expect(cancelled.totalCount).toBe(1);
    expect(cancelled.rows[0]!.staffName).toBe('Alex');

    const all = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA, FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'all',
    });
    expect(all.totalCount).toBe(7);
  });

  it('filters by staff IDs and excludes shifts outside date range', async () => {
    const filtered = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA, FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'completed',
      staffIds: [FIXTURE.staffA],
    });

    expect(filtered.totalCount).toBe(2);
    expect(filtered.summary.uniqueStaff).toBe(1);
    expect(filtered.rows.every((row) => row.staffId === FIXTURE.staffA)).toBe(true);
  });

  it('paginates detail rows independently from summary totals', async () => {
    const page1 = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA, FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'completed',
      page: 1,
      pageSize: 2,
    });

    expect(page1.rows).toHaveLength(2);
    expect(page1.totalCount).toBe(4);
    expect(page1.summary.totalShifts).toBe(4);
    expect(page1.hasMore).toBe(true);

    const page2 = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreA, FIXTURE.centreB],
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      status: 'completed',
      page: 2,
      pageSize: 2,
    });
    expect(page2.rows).toHaveLength(2);
    expect(page2.page).toBe(2);
  });

  it('returns zero rows with empty summary for unmatched filters', async () => {
    const result = await service.getCentreUsageShifts({
      centreIds: [FIXTURE.centreB],
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      status: 'completed',
    });

    expect(result.totalCount).toBe(0);
    expect(result.summary.totalShifts).toBe(0);
    expect(result.summary.totalScheduledMinutes).toBe(0);
    expect(result.summary.uniqueStaff).toBe(0);
  });

  describe('city filtering', () => {
    it('filters shift detail rows and summary by city', async () => {
      const torontoOnly = await service.getCentreUsageShifts({
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        cities: ['Toronto'],
      });

      expect(torontoOnly.totalCount).toBe(3);
      expect(torontoOnly.summary.totalShifts).toBe(3);
      expect(torontoOnly.rows.every((row) => row.centreName === 'Alpha Centre')).toBe(true);

      const ottawaOnly = await service.getCentreUsageShifts({
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        cities: ['Ottawa'],
      });

      expect(ottawaOnly.totalCount).toBe(1);
      expect(ottawaOnly.rows[0]!.centreName).toBe('Beta Centre');
    });

    it('intersects city with centre IDs and staff filter', async () => {
      const filtered = await service.getCentreUsageShifts({
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        cities: ['Toronto'],
        status: 'completed',
        staffIds: [FIXTURE.staffA],
      });

      expect(filtered.totalCount).toBe(2);
      expect(filtered.summary.uniqueStaff).toBe(1);
      expect(filtered.rows.every((row) => row.centreName === 'Alpha Centre')).toBe(true);
    });

    it('paginates city-filtered shift detail independently from summary', async () => {
      const page1 = await service.getCentreUsageShifts({
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        cities: ['Toronto', 'Ottawa'],
        status: 'all',
        page: 1,
        pageSize: 3,
      });

      expect(page1.totalCount).toBe(7);
      expect(page1.summary.totalShifts).toBe(7);
      expect(page1.rows).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
    });

    it('exports the full city-filtered shift detail dataset', async () => {
      const query = {
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        cities: ['Ottawa'] as const,
        status: 'completed' as const,
        page: 2,
        pageSize: 1,
      };
      const json = await service.getCentreUsageShifts(query);
      const csv = await exportService.exportCentreUsageShifts(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(1);
      expect(csv.content).toContain('Beta Centre');
      expect(csv.content).not.toContain('Alpha Centre');
    });
  });

  describe('CSV export', () => {
    it('matches filtered totalCount and ignores pagination', async () => {
      const query = {
        centreIds: [FIXTURE.centreA, FIXTURE.centreB],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        status: 'completed' as const,
        staffIds: [FIXTURE.staffA],
        page: 2,
        pageSize: 1,
      };
      const json = await service.getCentreUsageShifts(query);
      const csv = await exportService.exportCentreUsageShifts(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(json.totalCount);
      expect(csv.filename).toBe('centre-usage-shift-detail-2026-08-01-to-2026-08-31.csv');
      expect(csv.content).toContain('Date,Centre,Staff,Role,Status');
      expect(csv.content).toContain('Alex');
      expect(csv.content).not.toContain('Alexandra Morgan');
      expect(csv.content).toContain(',8,');
    });

    it('uses display names for Ops audience export', async () => {
      const query = {
        centreIds: [FIXTURE.centreA],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        status: 'completed' as const,
        audience: 'ops' as const,
      };
      const csv = await exportService.exportCentreUsageShifts(query);

      expect(csv.content).toContain('Alex');
      expect(csv.content).not.toContain('Alexandra Morgan');
      expect(csv.filename).toBe('centre-usage-shift-detail-2026-08-01-to-2026-08-31.csv');
    });

    it('uses legal names for Centre audience export', async () => {
      const query = {
        centreIds: [FIXTURE.centreA],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        status: 'completed' as const,
        audience: 'centre' as const,
      };
      const csv = await exportService.exportCentreUsageShifts(query);

      expect(csv.content).toContain('Alexandra Morgan');
      expect(csv.content).not.toContain(',Alex,');
      expect(csv.filename).toBe('centre-usage-shift-detail-centre-2026-08-01-to-2026-08-31.csv');
    });

    it('rejects Centre audience when multiple centres are selected', async () => {
      await expect(
        exportService.exportCentreUsageShifts({
          centreIds: [FIXTURE.centreA, FIXTURE.centreB],
          dateFrom: FIXTURE.dateFrom,
          dateTo: FIXTURE.dateTo,
          audience: 'centre',
        }),
      ).rejects.toThrow(/single Centre/i);
    });

    it('Centre audience export excludes other centres rows', async () => {
      const csv = await exportService.exportCentreUsageShifts({
        centreIds: [FIXTURE.centreA],
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        status: 'completed',
        audience: 'centre',
      });

      expect(csv.content).toContain('Alpha Centre');
      expect(csv.content).toContain('Alexandra Morgan');
      expect(csv.content).not.toContain('Beta Centre');
      expect(csv.content).not.toContain('Robert Beta');
    });
  });
});
