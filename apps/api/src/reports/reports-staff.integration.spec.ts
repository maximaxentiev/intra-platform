import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts, staff } from '../db/schema';
import { StaffUsageQueryDto } from './dto/staff-usage-query.dto';
import { ReportsService } from './reports.service';
import { ReportsStaffService } from './reports-staff.service';

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

const FIXTURE = {
  centre: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
  staffA: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  staffB: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
  staffC: 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
  staffInactive: 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
};

describe.skipIf(!POSTGRES_READY)('Reports staff PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ReportsStaffService;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    service = new ReportsStaffService(db, new ReportsService(db));

    await db.insert(centres).values({
      id: FIXTURE.centre,
      name: 'Staff Usage Centre',
      city: 'Toronto',
    });

    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalFirstName: 'Alice',
        legalLastName: 'Active',
        legalName: 'Alice Active',
        email: `${FIXTURE.staffA}@example.test`,
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffB,
        legalFirstName: 'Bob',
        legalLastName: 'Busy',
        legalName: 'Bob Busy',
        email: `${FIXTURE.staffB}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffC,
        legalFirstName: 'Carol',
        legalLastName: 'Clear',
        legalName: 'Carol Clear',
        email: `${FIXTURE.staffC}@example.test`,
        city: 'Toronto',
        role: 'Nanny',
        status: 'active',
      },
      {
        id: FIXTURE.staffInactive,
        legalFirstName: 'Inactive',
        legalLastName: 'Staff',
        legalName: 'Inactive Staff',
        email: `${FIXTURE.staffInactive}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'inactive',
      },
    ]);

    const rows = await db
      .insert(shifts)
      .values([
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-10',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-11',
          startTime: '09:15:00',
          endTime: '16:45:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-12',
          startTime: '08:00:00',
          endTime: '12:00:00',
          status: 'filled',
          assignedStaffId: FIXTURE.staffA,
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-13',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffB,
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-14',
          startTime: '21:00:00',
          endTime: '13:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-15',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'cancelled',
          assignedStaffId: FIXTURE.staffA,
          cancellationReason: 'Carer unavailable',
        },
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-08-16',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'pending',
          assignedStaffId: FIXTURE.staffA,
        },
      ])
      .returning({ id: shifts.id });

    shiftIds.push(...rows.map((row) => row.id));
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db
      .delete(staff)
      .where(
        inArray(staff.id, [
          FIXTURE.staffA,
          FIXTURE.staffB,
          FIXTURE.staffC,
          FIXTURE.staffInactive,
        ]),
      );
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await pool.end();
  });

  it('aggregates staff usage for active roster by default', async () => {
    const result = await service.getStaffUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
    });

    const staffA = result.rows.find((row) => row.staffId === FIXTURE.staffA)!;
    const staffB = result.rows.find((row) => row.staffId === FIXTURE.staffB)!;
    const staffC = result.rows.find((row) => row.staffId === FIXTURE.staffC)!;

    expect(result.staffIds).toBeNull();
    expect(result.rows.some((row) => row.staffId === FIXTURE.staffInactive)).toBe(false);

    expect(staffA.completedShifts).toBe(3);
    expect(staffA.completedScheduledMinutes).toBe(930);
    expect(staffA.filledShifts).toBe(1);
    expect(staffA.filledScheduledMinutes).toBe(240);
    expect(staffA.staffName).toBe('Alice Active');
    expect(staffA.role).toBe('ECE');

    expect(staffB.completedShifts).toBe(1);
    expect(staffB.completedScheduledMinutes).toBe(480);

    expect(staffC.completedShifts).toBe(0);
    expect(staffC.completedScheduledMinutes).toBe(0);
    expect(staffC.filledShifts).toBe(0);

    expect(result.summary.completedShifts).toBe(4);
    expect(result.summary.completedScheduledMinutes).toBe(1410);
    expect(result.summary.filledShifts).toBe(1);
    expect(result.summary.filledScheduledMinutes).toBe(240);
    expect(result.summary.totalStaff).toBeGreaterThanOrEqual(3);

    for (const row of [staffA, staffB, staffC]) {
      expect(typeof row.completedScheduledMinutes).toBe('number');
      expect(typeof row.filledScheduledMinutes).toBe('number');
    }
  });

  it('filters to one staff member', async () => {
    const result = await service.getStaffUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      staffIds: [FIXTURE.staffA],
    });

    expect(result.staffIds).toEqual([FIXTURE.staffA]);
    expect(result.rows).toHaveLength(1);
    expect(result.summary.completedShifts).toBe(3);
    expect(result.summary.filledShifts).toBe(1);
  });

  it('filters to several staff members and deduplicates IDs', async () => {
    const result = await service.getStaffUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      staffIds: [FIXTURE.staffA, FIXTURE.staffB, FIXTURE.staffC, FIXTURE.staffA],
    });

    expect(result.rows).toHaveLength(3);
    expect(result.summary.totalStaff).toBe(3);
  });

  it('supports legacy staffId filter', async () => {
    const result = await service.getStaffUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      staffId: FIXTURE.staffB,
    });

    expect(result.staffIds).toEqual([FIXTURE.staffB]);
    expect(result.rows).toHaveLength(1);
  });

  it('rejects nonexistent staff IDs', async () => {
    await expect(
      service.getStaffUsage({
        dateFrom: FIXTURE.dateFrom,
        dateTo: FIXTURE.dateTo,
        staffIds: [FIXTURE.staffA, '00000000-0000-4000-8000-000000000099'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects malformed staffIds query values', () => {
    const dto = plainToInstance(StaffUsageQueryDto, { staffIds: 'not-a-uuid' });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'staffIds')).toBe(true);
  });

  it('excludes cancelled and pending shifts from usage totals', async () => {
    const result = await service.getStaffUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      staffIds: [FIXTURE.staffA],
    });

    const row = result.rows[0]!;
    expect(row.completedShifts).toBe(3);
    expect(row.filledShifts).toBe(1);
    expect(row.completedShifts + row.filledShifts).toBe(4);
  });

  it('returns paginated completed shift drill-down', async () => {
    const result = await service.getStaffUsageShifts(FIXTURE.staffA, {
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      page: 1,
      pageSize: 50,
    });

    expect(result.staffId).toBe(FIXTURE.staffA);
    expect(result.totalCount).toBe(3);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.shiftDate >= result.items[1]!.shiftDate).toBe(true);
    expect(result.items.every((item) => item.scheduledMinutes >= 0)).toBe(true);
    expect(result.items.some((item) => item.scheduledMinutes === 480)).toBe(true);
    expect(result.items.some((item) => item.scheduledMinutes === 450)).toBe(true);
    expect(result.items.some((item) => item.scheduledMinutes === 0)).toBe(true);
    expect(result.items[0]).toMatchObject({
      centreName: 'Staff Usage Centre',
    });
  });

  it('excludes filled and cancelled shifts from drill-down', async () => {
    const result = await service.getStaffUsageShifts(FIXTURE.staffA, {
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
    });

    expect(result.totalCount).toBe(3);
    expect(result.items.every((item) => item.scheduledMinutes >= 0)).toBe(true);
  });
});
