import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import {
  centres,
  shiftHoursAdjustments,
  shiftHoursCapabilities,
  shifts,
  staff,
  users,
} from '../db/schema';
import { ShiftHoursAdjustmentService } from './shift-hours-adjustment.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const MIGRATION_0014 = readFileSync(
  join(__dirname, '../../drizzle/0014_shift_hours_adjustment_foundation.sql'),
  'utf8',
);
const TEST_PREFIX = `phase8a-${Date.now()}`;

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

describe.runIf(POSTGRES_READY)('Shift hours adjustment integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let hoursService: ShiftHoursAdjustmentService;
  let centreId: string;
  let staffId: string;
  let opsUserId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await pool.query(MIGRATION_0014);

    hoursService = new ShiftHoursAdjustmentService(db);

    const centreRows = await db
      .insert(centres)
      .values({ name: `Hours Centre ${TEST_PREFIX}`, city: 'Toronto' })
      .returning({ id: centres.id });
    centreId = centreRows[0]!.id;

    const staffRows = await db
      .insert(staff)
      .values({
        legalName: `Hours Staff ${TEST_PREFIX}`,
        email: `${TEST_PREFIX}@example.test`,
        phone: '4165550100',
        status: 'active',
      })
      .returning({ id: staff.id });
    staffId = staffRows[0]!.id;

    const userRows = await db
      .insert(users)
      .values({
        email: `ops-${TEST_PREFIX}@example.test`,
        passwordHash: 'test',
        fullName: 'Ops Tester',
        role: 'ops',
      })
      .returning({ id: users.id });
    opsUserId = userRows[0]!.id;
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  async function createShiftRow(status: 'filled' | 'completed' | 'cancelled' | 'pending') {
    const rows = await db
      .insert(shifts)
      .values({
        centreId,
        shiftDate: '2026-09-10',
        startTime: '09:00:00',
        endTime: '17:00:00',
        roleNeeded: 'ECA',
        status,
        assignedStaffId: status === 'pending' ? null : staffId,
        cancellationReason: status === 'cancelled' ? 'test cancellation' : '',
      })
      .returning({ id: shifts.id });
    return rows[0]!.id;
  }

  it('records Ops override on filled shift with snapshot and current fields', async () => {
    const shiftId = await createShiftRow('filled');
    const result = await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: `filled-${TEST_PREFIX}`,
      input: {
        actualStartTime: '09:15',
        actualEndTime: '16:45',
        note: 'Centre reported shorter break.',
      },
    });

    expect(result.created).toBe(true);
    expect(result.adjustment.source).toBe('ops');
    expect(result.adjustment.actorUserId).toBe(opsUserId);
    expect(result.adjustment.scheduledTotalMinutes).toBe(480);
    expect(result.adjustment.actualTotalMinutes).toBe(450);
    expect(result.adjustment.isCurrent).toBe(true);

    const shift = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);
    expect(String(shift[0]?.actualStartTime)).toMatch(/^09:15/);
    expect(shift[0]?.actualTotalMinutes).toBe(450);
    expect(shift[0]?.currentHoursSource).toBe('ops');
  });

  it('allows Ops override on completed and cancelled shifts', async () => {
    const completedId = await createShiftRow('completed');
    await hoursService.overrideActualHours({
      shiftId: completedId,
      actorUserId: opsUserId,
      idempotencyKey: `completed-${TEST_PREFIX}`,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Completed audit' },
    });

    const cancelledId = await createShiftRow('cancelled');
    await hoursService.overrideActualHours({
      shiftId: cancelledId,
      actorUserId: opsUserId,
      idempotencyKey: `cancelled-${TEST_PREFIX}`,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Cancelled dispute record' },
    });

    const cancelledShift = await db.select().from(shifts).where(eq(shifts.id, cancelledId)).limit(1);
    expect(cancelledShift[0]?.status).toBe('cancelled');
  });

  it('rejects pending/unassigned and missing note', async () => {
    const pendingId = await createShiftRow('pending');
    await expect(
      hoursService.overrideActualHours({
        shiftId: pendingId,
        actorUserId: opsUserId,
        idempotencyKey: `pending-${TEST_PREFIX}`,
        input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'x' },
      }),
    ).rejects.toThrow(BadRequestException);

    const filledId = await createShiftRow('filled');
    await expect(
      hoursService.overrideActualHours({
        shiftId: filledId,
        actorUserId: opsUserId,
        idempotencyKey: `note-${TEST_PREFIX}`,
        input: { actualStartTime: '09:00', actualEndTime: '17:00', note: '   ' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deduplicates identical idempotency keys', async () => {
    const shiftId = await createShiftRow('filled');
    const key = `dedupe-${TEST_PREFIX}`;
    const first = await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: key,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Once' },
    });
    const second = await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: key,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Once' },
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.adjustment.id).toBe(first.adjustment.id);

    const rows = await db
      .select()
      .from(shiftHoursAdjustments)
      .where(eq(shiftHoursAdjustments.shiftId, shiftId));
    expect(rows).toHaveLength(1);
  });

  it('supersedes previous adjustment and supports finalize sticky override', async () => {
    const shiftId = await createShiftRow('filled');
    const first = await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: `final-a-${TEST_PREFIX}`,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Initial', finalize: true },
    });
    const second = await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: `final-b-${TEST_PREFIX}`,
      input: { actualStartTime: '09:15', actualEndTime: '16:45', note: 'Corrected after finalize' },
    });

    const history = await hoursService.listAdjustments(shiftId);
    expect(history).toHaveLength(2);
    expect(history[0]?.supersededAt).not.toBeNull();
    expect(history[1]?.isCurrent).toBe(true);
    expect(second.adjustment.actualTotalMinutes).toBe(450);

    const shiftRows = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    expect(shiftRows[0]?.hoursFinalizedAt).not.toBeNull();
    expect(shiftRows[0]?.actualTotalMinutes).toBe(450);
    expect(first.adjustment.id).not.toBe(second.adjustment.id);
  });

  it('preserves scheduled snapshot when shift schedule is edited later', async () => {
    const shiftId = await createShiftRow('filled');
    await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: `schedule-${TEST_PREFIX}`,
      input: { actualStartTime: '09:15', actualEndTime: '16:45', note: 'Before schedule edit' },
    });

    await db
      .update(shifts)
      .set({ startTime: '10:00:00', endTime: '18:00:00', updatedAt: new Date() })
      .where(eq(shifts.id, shiftId));

    const history = await hoursService.listAdjustments(shiftId);
    expect(history[0]?.scheduledStartTime).toMatch(/^09:00/);
    expect(history[0]?.scheduledEndTime).toMatch(/^17:00/);
    expect(history[0]?.actualStartTime).toMatch(/^09:15/);

    const shiftRows = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    expect(String(shiftRows[0]?.startTime)).toMatch(/^10:00/);
    expect(shiftRows[0]?.actualTotalMinutes).toBe(450);
  });

  it('cascades hours history and capability on shift delete', async () => {
    const shiftId = await createShiftRow('filled');
    await hoursService.overrideActualHours({
      shiftId,
      actorUserId: opsUserId,
      idempotencyKey: `delete-${TEST_PREFIX}`,
      input: { actualStartTime: '09:00', actualEndTime: '17:00', note: 'Delete test' },
    });

    await db.insert(shiftHoursCapabilities).values({
      shiftId,
      publicSlug: `slug-${TEST_PREFIX}-${shiftId.slice(0, 8)}`,
      tokenHash: 'deadbeef',
      assignmentEpoch: 1,
      assignedStaffId: staffId,
    });

    await db.delete(shifts).where(eq(shifts.id, shiftId));

    const history = await db
      .select()
      .from(shiftHoursAdjustments)
      .where(eq(shiftHoursAdjustments.shiftId, shiftId));
    const capabilities = await db
      .select()
      .from(shiftHoursCapabilities)
      .where(eq(shiftHoursCapabilities.shiftId, shiftId));
    expect(history).toHaveLength(0);
    expect(capabilities).toHaveLength(0);
  });
});

describe.runIf(!POSTGRES_READY)('Shift hours adjustment integration', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
