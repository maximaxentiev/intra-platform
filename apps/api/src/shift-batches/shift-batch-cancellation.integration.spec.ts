import { ConfigService } from '@nestjs/config';
import { and, eq, inArray } from 'drizzle-orm';
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
  shiftContacted,
  shifts,
  staff,
  users,
} from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { ShiftReminderService } from '../shifts/shift-reminder.service';
import { ShiftBatchCancellationService } from './shift-batch-cancellation.service';
import {
  BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE,
  BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE,
} from './shift-batch-cancellation.types';

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
  staffId: '77777777-7777-4777-8777-777777777704',
  staffId2: '77777777-7777-4777-8777-777777777705',
};

describe.runIf(POSTGRES_READY)('Batch cancellation integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let cancellationService: ShiftBatchCancellationService;
  const batchIds: string[] = [];

  async function createBatch(children: Array<{ status: string; assignedStaffId?: string | null }>) {
    const batchRows = await db
      .insert(shiftBatches)
      .values({ centreId: FIXTURE.centreId, createdByUserId: FIXTURE.opsUser })
      .returning({ id: shiftBatches.id });
    const batchId = batchRows[0]!.id;
    batchIds.push(batchId);

    for (const [index, child] of children.entries()) {
      await db.insert(shifts).values({
        centreId: FIXTURE.centreId,
        batchId,
        shiftDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
        startTime: '09:00:00',
        endTime: '17:00:00',
        roleNeeded: 'ECE',
        status: child.status as never,
        assignedStaffId: child.assignedStaffId ?? null,
      });
    }

    return batchId;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);
    await pool.query(`
      ALTER TABLE shift_batches
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
        ADD COLUMN IF NOT EXISTS cancellation_reason text;
    `);

    const scheduled = new ScheduledCommunicationsService(db);
    const automated = new AutomatedCommunicationsService(scheduled, {
      enqueue: vi.fn(),
      syncJobSchedule: vi.fn(),
      ensureJobExists: vi.fn(),
    } as never);
    cancellationService = new ShiftBatchCancellationService(
      db,
      automated,
      new PlatformAuditService(db),
      new ShiftReminderService(db, automated),
    );

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffId, FIXTURE.staffId2]));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-cancel@example.test',
      fullName: 'Batch Cancel Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Cancel Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(centreContacts).values({
      id: FIXTURE.contactId,
      centreId: FIXTURE.centreId,
      name: 'Primary',
      email: 'primary@cancel.example.test',
      sortOrder: 0,
    });
    await db.insert(staff).values([
      {
        id: FIXTURE.staffId,
        legalName: 'Jane Smith',
        displayName: 'Jane Smith',
        useDisplayName: true,
        email: 'jane@example.test',
        status: 'active',
        documentSlug: 'jane-smith-cancel',
      },
      {
        id: FIXTURE.staffId2,
        legalName: 'Alex Lee',
        displayName: 'Alex Lee',
        useDisplayName: true,
        email: 'alex@example.test',
        status: 'active',
        documentSlug: 'alex-lee-cancel',
      },
    ]);
  });

  afterAll(async () => {
    if (batchIds.length) {
      await db.delete(shifts).where(inArray(shifts.batchId, batchIds));
      await db.delete(scheduledCommunications).where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    await pool.end();
  });

  it('Case A: cancels children with no communications', async () => {
    const batchId = await createBatch([
      { status: 'pending' },
      { status: 'filled', assignedStaffId: null },
    ]);

    const result = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'Centre closed', {
      centre: true,
      carer: true,
    });

    expect(result.cancelledChildCount).toBe(2);
    expect(result.scheduledCommunicationIds).toHaveLength(0);

    const batch = await db.select().from(shiftBatches).where(eq(shiftBatches.id, batchId)).limit(1);
    expect(batch[0]?.cancelledAt).toBeTruthy();

    const comms = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, batchId));
    expect(comms).toHaveLength(0);
  });

  it('Case B: schedules carer-only communications and rejects centre', async () => {
    const batchId = await createBatch([
      { status: 'filled', assignedStaffId: FIXTURE.staffId },
      { status: 'pending' },
    ]);

    const result = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'Schedule change', {
      centre: true,
      carer: true,
    });

    expect(result.cancelledChildCount).toBe(2);
    expect(result.scheduledCommunicationIds).toHaveLength(1);

    const comms = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, batchId));
    expect(comms.some((row) => row.communicationType === BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE)).toBe(true);
    expect(comms.some((row) => row.communicationType === BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE)).toBe(false);
  });

  it('Case C: allows centre communication after prior confirmation', async () => {
    const batchId = await createBatch([{ status: 'filled', assignedStaffId: FIXTURE.staffId }]);
    await db
      .update(shiftBatches)
      .set({
        requestCompletedAt: new Date('2026-08-01T12:00:00Z'),
        confirmationRevision: 1,
      })
      .where(eq(shiftBatches.id, batchId));

    const result = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'No longer needed', {
      centre: true,
      carer: false,
    });

    expect(result.cancelledChildCount).toBe(1);
    const comms = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, batchId));
    expect(comms.some((row) => row.communicationType === BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE)).toBe(true);
  });

  it('is idempotent on repeated cancel', async () => {
    const batchId = await createBatch([{ status: 'pending' }]);
    const first = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'Once');
    const second = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'Twice');

    expect(first.alreadyCancelled).toBe(false);
    expect(second.alreadyCancelled).toBe(true);
    expect(second.cancelledChildCount).toBe(0);

    const comms = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, batchId));
    expect(comms).toHaveLength(0);
  });

  it('leaves already-cancelled children untouched', async () => {
    const batchId = await createBatch([
      { status: 'cancelled' },
      { status: 'pending' },
      { status: 'filled', assignedStaffId: FIXTURE.staffId2 },
    ]);

    const before = await db.select().from(shifts).where(eq(shifts.batchId, batchId));
    const alreadyCancelled = before.find((row) => row.status === 'cancelled')!;

    const result = await cancellationService.cancel(batchId, FIXTURE.opsUser, 'Partial batch', {
      carer: true,
    });

    expect(result.cancelledChildCount).toBe(2);
    const after = await db.select().from(shifts).where(eq(shifts.batchId, batchId));
    const unchanged = after.find((row) => row.id === alreadyCancelled.id);
    expect(unchanged?.updatedAt?.toISOString()).toBe(alreadyCancelled.updatedAt?.toISOString());
  });
});
