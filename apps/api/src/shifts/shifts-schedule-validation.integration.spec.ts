import { BadRequestException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts } from '../db/schema';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftCancellationService } from './shift-cancellation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftReminderService } from './shift-reminder.service';
import { ShiftsService } from './shifts.service';

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
  centre: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
};

describe.skipIf(!POSTGRES_READY)('ShiftsService schedule validation integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftsService;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    db = drizzle(pool, { schema });
    service = new ShiftsService(
      db,
      {} as ShiftAssignmentConfirmationService,
      {} as ShiftMatchingService,
      {} as ShiftReminderService,
      {} as ShiftCancellationService,
    );

    await db.insert(centres).values({
      id: FIXTURE.centre,
      name: 'Schedule Validation Centre',
      city: 'Toronto',
    });
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await pool.end();
  });

  it('rejects create when end time is not after start time', async () => {
    await expect(
      service.create({
        centreId: FIXTURE.centre,
        shiftDate: '2026-08-19',
        startTime: '21:00:00',
        endTime: '13:00:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects patch when updated times are not a valid same-day range', async () => {
    const created = await service.create({
      centreId: FIXTURE.centre,
      shiftDate: '2026-08-19',
      startTime: '09:00:00',
      endTime: '17:00:00',
    });
    shiftIds.push(created.id);

    await expect(
      service.update(created.id, {
        startTime: '21:00:00',
        endTime: '13:00:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
