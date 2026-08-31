import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { ScheduledCommunicationsService } from '../automated-communications/scheduled-communications.service';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import * as schema from '../db/schema';
import {
  centreContacts,
  centres,
  scheduledCommunications,
  shiftBatches,
  shifts,
  users,
} from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { ShiftBatchProgressCommunicationService } from './shift-batch-progress-communication.service';
import { buildBatchProgress70IdempotencyKey } from './shift-batch-progress.types';

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
  centreId: '77777777-7777-4777-8777-777777777701',
  opsUser: '77777777-7777-4777-8777-777777777702',
  contactId: '77777777-7777-4777-8777-777777777703',
};

async function ensureProgressEmailColumn(pool: Pool) {
  await pool.query(
    'ALTER TABLE shift_batches ADD COLUMN IF NOT EXISTS progress_email_scheduled_at timestamptz NULL',
  );
}


describe.runIf(POSTGRES_READY)('Batch progress 70% email integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let progressService: ShiftBatchProgressCommunicationService;
  const batchIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);
    await ensureProgressEmailColumn(pool);

    const scheduled = new ScheduledCommunicationsService(db);
    const automated = new AutomatedCommunicationsService(scheduled, {
      enqueue: vi.fn(),
      syncJobSchedule: vi.fn(),
      ensureJobExists: vi.fn(),
    } as never);
    progressService = new ShiftBatchProgressCommunicationService(
      db,
      automated,
      new PlatformAuditService(db),
    );

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-progress@example.test',
      fullName: 'Progress Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Progress Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(centreContacts).values({
      id: FIXTURE.contactId,
      centreId: FIXTURE.centreId,
      name: 'Primary',
      email: 'primary@centre.example.test',
      sortOrder: 0,
    });
  });

  afterAll(async () => {
    if (batchIds.length) {
      await db.delete(shifts).where(inArray(shifts.batchId, batchIds));
      await db.delete(scheduledCommunications).where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  async function createBatchWithStatuses(statuses: string[]) {
    const batchRows = await db
      .insert(shiftBatches)
      .values({ centreId: FIXTURE.centreId, createdByUserId: FIXTURE.opsUser })
      .returning({ id: shiftBatches.id });
    const batchId = batchRows[0]!.id;
    batchIds.push(batchId);

    for (let i = 0; i < statuses.length; i++) {
      await db.insert(shifts).values({
        centreId: FIXTURE.centreId,
        batchId,
        shiftDate: '2026-09-10',
        startTime: `${8 + i}:00:00`,
        endTime: `${16 + i}:00:00`,
        roleNeeded: 'ECE',
        status: statuses[i] as never,
        assignedStaffId: statuses[i] === 'filled' ? null : null,
      });
    }

    return batchId;
  }

  it('does not schedule at 6/10 (60%)', async () => {
    const batchId = await createBatchWithStatuses([
      ...Array.from({ length: 6 }, () => 'filled'),
      ...Array.from({ length: 4 }, () => 'pending'),
    ]);

    const scheduledId = await progressService.evaluateAndSchedule(batchId);
    expect(scheduledId).toBeNull();

    const batch = await db
      .select({ progressEmailScheduledAt: shiftBatches.progressEmailScheduledAt })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId));
    expect(batch[0]?.progressEmailScheduledAt).toBeNull();
  });

  it('schedules exactly once at 7/10 (70%)', async () => {
    const batchId = await createBatchWithStatuses([
      ...Array.from({ length: 7 }, () => 'filled'),
      ...Array.from({ length: 3 }, () => 'pending'),
    ]);

    const first = await progressService.evaluateAndSchedule(batchId);
    const second = await progressService.evaluateAndSchedule(batchId);
    expect(first).toBeTruthy();
    expect(second).toBeNull();

    const commRows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, buildBatchProgress70IdempotencyKey(batchId)));
    expect(commRows).toHaveLength(1);
    expect(commRows[0]?.communicationType).toBe('batch_progress_70');
    expect(commRows[0]?.entityType).toBe('shift_batch');
    expect(commRows[0]?.recipientType).toBe('centre');
  });

  it('does not schedule at 100%', async () => {
    const batchId = await createBatchWithStatuses(Array.from({ length: 3 }, () => 'filled'));
    const scheduledId = await progressService.evaluateAndSchedule(batchId);
    expect(scheduledId).toBeNull();
  });

  it('becomes eligible when cancellation changes denominator to 75%', async () => {
    const batchId = await createBatchWithStatuses([
      ...Array.from({ length: 6 }, () => 'filled'),
      ...Array.from({ length: 4 }, () => 'pending'),
    ]);

    expect(await progressService.evaluateAndSchedule(batchId)).toBeNull();

    const pending = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.batchId, batchId))
      .limit(2);
    for (const row of pending) {
      await db.update(shifts).set({ status: 'cancelled' }).where(eq(shifts.id, row.id));
    }

    expect(await progressService.evaluateAndSchedule(batchId)).toBeTruthy();
  });

  it('blocks when primary contact email is missing and allows retry after fix', async () => {
    await db
      .update(centreContacts)
      .set({ email: '' })
      .where(eq(centreContacts.id, FIXTURE.contactId));

    const batchId = await createBatchWithStatuses([
      ...Array.from({ length: 7 }, () => 'filled'),
      ...Array.from({ length: 3 }, () => 'pending'),
    ]);

    expect(await progressService.evaluateAndSchedule(batchId)).toBeNull();
    const status = await progressService.resolveProgressEmailStatus(batchId);
    expect(status.state).toBe('blocked');

    await db
      .update(centreContacts)
      .set({ email: 'primary@centre.example.test' })
      .where(eq(centreContacts.id, FIXTURE.contactId));

    const retry = await progressService.retryProgressEmail(batchId, FIXTURE.opsUser);
    expect(retry.scheduled).toBe(true);
  });
});
