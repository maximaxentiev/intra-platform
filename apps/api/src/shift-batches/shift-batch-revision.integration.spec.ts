import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { centres, shiftBatches, shiftComments, shifts, staff, users } from '../db/schema';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import {
  assignContactedStaffForIntegration,
  createIntegrationShiftsService,
} from '../shifts/shifts-integration-test.util';
import type { ShiftsService } from '../shifts/shifts.service';
import { ShiftsFeedService } from '../shifts/shifts-feed.service';
import { ShiftBatchesService } from './shift-batches.service';
import { createMockShiftBatchProgressCommunicationService } from './shift-batch-progress-test.util';
import {
  createMockShiftBatchCompletionReadinessService,
  createMockShiftBatchCompletionService,
  createMockShiftBatchUpdateConfirmationService,
} from './shift-batch-completion-test.util';

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
  centreId: '55555555-5555-4555-8555-555555555501',
  opsUser: '55555555-5555-4555-8555-555555555502',
  staffA: '55555555-5555-4555-8555-555555555503',
  staffB: '55555555-5555-4555-8555-555555555504',
};

async function markBatchConfirmed(
  db: NodePgDatabase<typeof schema>,
  batchId: string,
  opsUser: string,
) {
  const confirmedAt = new Date('2028-06-01T12:00:00Z');
  await db
    .update(shiftBatches)
    .set({
      requestCompletedAt: confirmedAt,
      requestCompletedByUserId: opsUser,
      confirmationRevision: 1,
      pendingChangeRevision: 0,
      lastConfirmationScheduledAt: confirmedAt,
    })
    .where(eq(shiftBatches.id, batchId));
}

describe.runIf(POSTGRES_READY)('Batch confirmation revision integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let shiftsService: ShiftsService;
  let batchesService: ShiftBatchesService;
  let feedService: ShiftsFeedService;
  const batchIds: string[] = [];
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensurePlatformAuditTable(pool);
    shiftsService = createIntegrationShiftsService(db);
    batchesService = new ShiftBatchesService(
      db,
      shiftsService,
      createMockShiftBatchProgressCommunicationService(),
      createMockShiftBatchCompletionReadinessService(),
      createMockShiftBatchCompletionService(),
      createMockShiftBatchUpdateConfirmationService(),
      { getBatchActivity: vi.fn() } as never,
    );
    feedService = new ShiftsFeedService(db);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-revision@example.test',
      fullName: 'Revision Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Revision Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalName: 'Carer A',
        email: 'carer-a@example.test',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffB,
        legalName: 'Carer B',
        email: 'carer-b@example.test',
        role: 'ECE',
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  it('has revision columns from migration 0026', async () => {
    const rows = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'shift_batches'
         AND column_name IN (
           'confirmation_revision',
           'pending_change_revision',
           'last_confirmation_scheduled_at'
         )`,
    );
    expect(rows.rows.map((row) => row.column_name).sort()).toEqual([
      'confirmation_revision',
      'last_confirmation_scheduled_at',
      'pending_change_revision',
    ]);
  });

  it('cancels one of two persisted batch children without error and marks batch stale', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreId,
        shifts: [
          {
            shiftDate: '2028-07-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
          {
            shiftDate: '2028-07-02',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECA',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const [childA, childB] = created.created;
    await db
      .update(shifts)
      .set({ status: 'filled', assignedStaffId: FIXTURE.staffA })
      .where(inArray(shifts.id, [childA!.id, childB!.id]));
    await markBatchConfirmed(db, created.batch.id, FIXTURE.opsUser);

    await shiftsService.changeStatus(
      childA!.id,
      { status: 'cancelled', cancellationReason: 'Centre no longer needs this shift.' },
      FIXTURE.opsUser,
    );

    const batchRow = await db
      .select()
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);
    expect(batchRow[0]?.pendingChangeRevision).toBeGreaterThan(0);

    const workspace = await batchesService.getWorkspace(created.batch.id);
    expect(workspace.confirmationUiState).toBe('ready_to_send_updates');

    const feed = await feedService.feed({
      centreId: FIXTURE.centreId,
      from: '2028-07-01',
      to: '2028-07-31',
      page: 1,
      pageSize: 25,
    });
    const batchItem = feed.items.find(
      (item) => item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(batchItem?.type === 'batch' && batchItem.batch.displayState).toBe('ready_to_send_updates');
  });

  it('records staleness on replacement and aligns workspace with feed', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreId,
        shifts: [
          {
            shiftDate: '2028-08-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    const childId = created.created[0]!.id;
    shiftIds.push(childId);

    await db
      .update(shifts)
      .set({ status: 'filled', assignedStaffId: FIXTURE.staffA })
      .where(eq(shifts.id, childId));
    await markBatchConfirmed(db, created.batch.id, FIXTURE.opsUser);

    await assignContactedStaffForIntegration(
      shiftsService,
      childId,
      FIXTURE.staffB,
      FIXTURE.opsUser,
    );

    const workspace = await batchesService.getWorkspace(created.batch.id);
    expect(workspace.pendingChangeRevision).toBeGreaterThan(0);
    expect(workspace.confirmationUiState).toBe('ready_to_send_updates');

    const feed = await feedService.feed({
      centreId: FIXTURE.centreId,
      from: '2028-08-01',
      to: '2028-08-31',
      page: 1,
      pageSize: 25,
    });
    const item = feed.items.find(
      (row) => row.type === 'batch' && row.batch.id === created.batch.id,
    );
    expect(item?.type === 'batch' && item.batch.displayState).toBe('ready_to_send_updates');
    expect(workspace.confirmationUiState).toBe(item?.type === 'batch' ? item.batch.displayState : '');
  });

  it('does not stale batch on internal comment', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreId,
        shifts: [
          {
            shiftDate: '2028-09-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    const childId = created.created[0]!.id;
    shiftIds.push(childId);

    await markBatchConfirmed(db, created.batch.id, FIXTURE.opsUser);
    await shiftsService.addComment(childId, FIXTURE.opsUser, { body: 'Ops-only note' });

    const batchRow = await db
      .select({ pendingChangeRevision: shiftBatches.pendingChangeRevision })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);
    expect(batchRow[0]?.pendingChangeRevision).toBe(0);

    const comments = await db.select().from(shiftComments).where(eq(shiftComments.shiftId, childId));
    expect(comments).toHaveLength(1);
  });

  it('stales batch on shift notes edit after confirmation', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreId,
        shifts: [
          {
            shiftDate: '2028-10-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
            confirmationNotes: 'Original',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    const childId = created.created[0]!.id;
    shiftIds.push(childId);

    await db.update(shifts).set({ status: 'filled', assignedStaffId: FIXTURE.staffA }).where(eq(shifts.id, childId));
    await markBatchConfirmed(db, created.batch.id, FIXTURE.opsUser);

    await shiftsService.update(childId, { confirmationNotes: 'Revised notes' }, FIXTURE.opsUser);

    const batchRow = await db
      .select({ pendingChangeRevision: shiftBatches.pendingChangeRevision })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);
    expect(batchRow[0]?.pendingChangeRevision).toBeGreaterThan(0);
  });
});
