import { BadRequestException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { centres, shiftBatches, shiftComments, shifts, users } from '../db/schema';
import { ShiftBatchesService } from './shift-batches.service';
import { ShiftAssignmentConfirmationService } from '../shifts/shift-assignment-confirmation.service';
import { ShiftMatchingService } from '../shifts/shift-matching.service';
import { createMockShiftCancellationService } from '../shifts/shift-cancellation-test.util';
import { createMockShiftReminderService } from '../shifts/shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from '../shifts/shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from '../shifts/shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import {
  createMockShiftBatchCompletionReadinessService,
  createMockShiftBatchCompletionService,
} from './shift-batch-completion-test.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { ShiftsService } from '../shifts/shifts.service';

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
  centreA: '88888888-8888-4888-8888-888888888801',
  centreB: '88888888-8888-4888-8888-888888888802',
  opsUser: '88888888-8888-4888-8888-888888888803',
};

function buildShiftsService(db: NodePgDatabase<typeof schema>) {
  return new ShiftsService(
    db,
    {
      sendAssignmentConfirmations: vi.fn(),
    } as unknown as ShiftAssignmentConfirmationService,
    {
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    new PlatformAuditService(db),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
      
    createMockShiftBatchProgressCommunicationService(),
  );
}

describe.skipIf(!POSTGRES_READY)('Shift batches Phase A integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let shiftsService: ShiftsService;
  let batchesService: ShiftBatchesService;
  const batchIds: string[] = [];
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensurePlatformAuditTable(pool);
    shiftsService = buildShiftsService(db);
    batchesService = new ShiftBatchesService(
      db,
      shiftsService,
      createMockShiftBatchProgressCommunicationService(),
      createMockShiftBatchCompletionReadinessService(),
      createMockShiftBatchCompletionService(),
      { getBatchActivity: vi.fn() } as never,
    );

    await db.delete(shifts).where(inArray(shifts.centreId, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(shiftBatches).where(inArray(shiftBatches.centreId, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'shift-batch-phase-a@example.test',
      fullName: 'Batch Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values([
      { id: FIXTURE.centreA, name: 'Batch Centre A', city: 'Toronto', status: 'active' },
      { id: FIXTURE.centreB, name: 'Batch Centre B', city: 'Toronto', status: 'active' },
    ]);
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  it('creates a batch for a centre with authenticated actor', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);
    expect(batch.centreId).toBe(FIXTURE.centreA);
    expect(batch.createdByUserId).toBe(FIXTURE.opsUser);
    expect(batch.requestCompletedAt).toBeNull();
  });

  it('atomically creates a batch with child shifts in one transaction', async () => {
    const result = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: [
          {
            shiftDate: '2026-09-05',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
            confirmationNotes: 'Batch atomic note',
            internalComment: 'Atomic internal',
          },
          {
            shiftDate: '2026-09-06',
            startTime: '09:00:00',
            endTime: '17:00:00',
            roleNeeded: 'ECA',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(result.batch.id);
    shiftIds.push(...result.created.map((row) => row.id));

    expect(result.created).toHaveLength(2);
    const workspace = await batchesService.getWorkspace(result.batch.id);
    expect(workspace.shifts).toHaveLength(2);
    expect(workspace.shifts[0]?.confirmationNotes).toBe('Batch atomic note');
  });

  it('adds a child shift forced to batch centre with confirmation notes', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);

    const child = await batchesService.addChild(
      batch.id,
      {
        shiftDate: '2026-09-01',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECE',
        confirmationNotes: '  Side entrance  ',
        internalComment: ' Ops only note ',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(child.id);

    const workspace = await batchesService.getWorkspace(batch.id);
    expect(workspace.shifts).toHaveLength(1);
    expect(workspace.shifts[0]?.confirmationNotes).toBe('Side entrance');

    const comments = await db
      .select()
      .from(shiftComments)
      .where(eq(shiftComments.shiftId, child.id));
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('Ops only note');
    expect(comments[0]?.authorId).toBe(FIXTURE.opsUser);
  });

  it('bulk creates 30 chronologically sorted children atomically', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);

    const payload = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return {
        shiftDate: `2026-09-${day}`,
        startTime: '09:00:00',
        endTime: '17:00:00',
        roleNeeded: 'ECA' as const,
        confirmationNotes: i % 5 === 0 ? `Note ${i}` : undefined,
        internalComment: i === 0 ? 'First row comment' : undefined,
      };
    });

    const result = await batchesService.bulkAddChildren(batch.id, { shifts: payload }, FIXTURE.opsUser);
    expect(result.created).toHaveLength(30);
    shiftIds.push(...result.created.map((r) => r.id));

    const workspace = await batchesService.getWorkspace(batch.id);
    expect(workspace.shifts).toHaveLength(30);
    const dates = workspace.shifts.map((s) => s.shiftDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it('rejects mismatched centre on child create', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);

    await expect(
      shiftsService.create(
        {
          centreId: FIXTURE.centreB,
          shiftDate: '2026-09-10',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECA',
        },
        FIXTURE.opsUser,
        { batchId: batch.id },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects mismatched centre at database level via composite FK', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);

    await expect(
      db.insert(shifts).values({
        centreId: FIXTURE.centreB,
        batchId: batch.id,
        shiftDate: '2026-09-20',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECA',
      }),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects centre change on a batch child at the service layer', async () => {
    const batch = await batchesService.create({ centreId: FIXTURE.centreA }, FIXTURE.opsUser);
    batchIds.push(batch.id);

    const child = await batchesService.addChild(
      batch.id,
      {
        shiftDate: '2026-09-21',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECA',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(child.id);

    await expect(
      shiftsService.update(child.id, { centreId: FIXTURE.centreB }, FIXTURE.opsUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts individual shifts with null batch_id', async () => {
    const created = await shiftsService.create(
      {
        centreId: FIXTURE.centreA,
        shiftDate: '2026-09-15',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECA',
        notes: 'legacy internal only',
        confirmationNotes: 'External note',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);

    const row = await shiftsService.get(created.id);
    expect(row.batchId).toBeNull();
    expect(row.notes).toBe('legacy internal only');
    expect(row.confirmationNotes).toBe('External note');
  });

  it('does not copy legacy notes into confirmationNotes', async () => {
    const created = await shiftsService.create(
      {
        centreId: FIXTURE.centreA,
        shiftDate: '2026-09-16',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECA',
        notes: 'internal scratchpad',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);
    const row = await shiftsService.get(created.id);
    expect(row.notes).toBe('internal scratchpad');
    expect(row.confirmationNotes).toBeNull();
  });
});
