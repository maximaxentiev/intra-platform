import { NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts, staff } from '../db/schema';
import { ReportsService } from './reports.service';
import { ReportsShiftService } from './reports-shift.service';

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
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    service = new ReportsShiftService(db, new ReportsService(db));

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

    expect(result.summary.total).toBe(11);
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
    expect(result.summary.total).toBe(0);
    expect(result.summary.fillRatePercent).toBeNull();
  });

  it('filters by centre and rejects nonexistent centre', async () => {
    const filtered = await service.getShiftFulfillment({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
      centreId: FIXTURE.centreB,
    });
    expect(filtered.summary.total).toBe(1);
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

  it('aggregates centre usage including zero-shift centres', async () => {
    const result = await service.getCentreUsage({
      dateFrom: FIXTURE.dateFrom,
      dateTo: FIXTURE.dateTo,
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
    expect(centreC.fillRatePercent).toBeNull();

    expect(result.rows[0]!.centreId).toBe(FIXTURE.centreA);
    expect(result.rows.some((r) => r.centreId === FIXTURE.centreC)).toBe(true);
  });

  it('defaults to current Toronto month when dates omitted', async () => {
    const result = await service.getShiftFulfillment({});
    expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-01$/);
    expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
