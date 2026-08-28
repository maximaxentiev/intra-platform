import { BadRequestException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import * as schema from '../db/schema';
import { centres, shifts, staff, users } from '../db/schema';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
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
  centre: '99999999-9999-4999-8999-999999999911',
  staffA: '99999999-9999-4999-8999-999999999912',
  opsUser: '99999999-9999-4999-8999-999999999913',
};

function buildService(db: NodePgDatabase<typeof schema>) {
  return new ShiftsService(
    db,
    {
      sendAssignmentConfirmations: vi.fn().mockResolvedValue({
        centre: { attempted: false, sent: false },
        carer: { attempted: false, sent: false },
      }),
    } as unknown as ShiftAssignmentConfirmationService,
    {
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    new PlatformAuditService(db),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
  );
}

describe.skipIf(!POSTGRES_READY)('ShiftsService lifecycle contracts', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftsService;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensurePlatformAuditTable(pool);
    service = buildService(db);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centre));
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffA));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await pool.query(`DELETE FROM users WHERE email = $1`, ['shift-lifecycle-ops@example.test']);
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'shift-lifecycle-ops@example.test',
      fullName: 'Shift Lifecycle Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centre,
      name: 'Lifecycle Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(staff).values({
      id: FIXTURE.staffA,
      legalName: 'Lifecycle Staff',
      email: 'lifecycle-staff@example.test',
      city: 'Toronto',
      role: 'ECE',
      status: 'active',
    });
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffA));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  async function createPendingShift(date: string) {
    const created = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: date,
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);
    return created;
  }

  it('cancels with a valid reason and trims it', async () => {
    const created = await createPendingShift('2026-10-01');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);

    const cancelled = await service.changeStatus(
      created.id,
      { status: 'cancelled', cancellationReason: '  Weather closure  ' },
      FIXTURE.opsUser,
    );

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Weather closure');
    expect(cancelled.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('rejects cancellation with empty or whitespace-only reason', async () => {
    const created = await createPendingShift('2026-10-02');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);

    await expect(
      service.changeStatus(created.id, { status: 'cancelled', cancellationReason: '' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changeStatus(created.id, { status: 'cancelled', cancellationReason: '   ' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changeStatus(created.id, { status: 'cancelled' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('filled');
    expect(row[0]?.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('allows completed without cancellationReason when shift is filled', async () => {
    const created = await createPendingShift('2026-10-03');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);

    const completed = await service.changeStatus(
      created.id,
      { status: 'completed' },
      FIXTURE.opsUser,
    );

    expect(completed.status).toBe('completed');
    expect(completed.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('rejects manual completion from pending', async () => {
    const created = await createPendingShift('2026-10-04');

    await expect(
      service.changeStatus(created.id, { status: 'completed' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('pending');
  });

  it('creates shifts in pending status', async () => {
    const created = await createPendingShift('2026-10-05');
    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('pending');
    expect(row[0]?.assignedStaffId).toBeNull();
  });

  it('unassigns via the dedicated endpoint', async () => {
    const created = await createPendingShift('2026-10-06');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);

    const unassigned = await service.unassign(created.id, FIXTURE.opsUser);
    expect(unassigned.shift.status).toBe('pending');
    expect(unassigned.shift.assignedStaffId).toBeNull();
  });

  it('rejects generic status transition to pending', async () => {
    const created = await createPendingShift('2026-10-07');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);

    await expect(
      service.changeStatus(created.id, { status: 'pending' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('filled');
    expect(row[0]?.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('preserves cancelled assignment history when pending is rejected', async () => {
    const created = await createPendingShift('2026-10-08');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);
    await service.changeStatus(
      created.id,
      { status: 'cancelled', cancellationReason: 'Centre closed' },
      FIXTURE.opsUser,
    );

    await expect(
      service.changeStatus(created.id, { status: 'pending' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('cancelled');
    expect(row[0]?.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('preserves completed assignment history when pending is rejected', async () => {
    const created = await createPendingShift('2026-10-09');
    await service.assign(created.id, FIXTURE.staffA, FIXTURE.opsUser);
    await service.changeStatus(created.id, { status: 'completed' }, FIXTURE.opsUser);

    await expect(
      service.changeStatus(created.id, { status: 'pending' }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await db.select().from(shifts).where(eq(shifts.id, created.id)).limit(1);
    expect(row[0]?.status).toBe('completed');
    expect(row[0]?.assignedStaffId).toBe(FIXTURE.staffA);
  });
});
