import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
  platformAuditEvents,
  scheduledCommunications,
  shiftBatches,
  shifts,
  staff,
  users,
} from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import {
  assignContactedStaffForIntegration,
  createIntegrationShiftsService,
} from '../shifts/shifts-integration-test.util';
import type { ShiftsService } from '../shifts/shifts.service';
import { ShiftsFeedService } from '../shifts/shifts-feed.service';
import { ShiftBatchChangeHistoryService } from './shift-batch-change-history.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import {
  buildBatchConfirmationRevisionIdempotencyKey,
} from './shift-batch-completion.types';
import { ShiftBatchUpdateConfirmationService } from './shift-batch-update-confirmation.service';
import { ShiftBatchesService } from './shift-batches.service';
import { createMockShiftBatchProgressCommunicationService } from './shift-batch-progress-test.util';
import {
  clearStaffPublicShareDocuments,
  createBatchDocumentShareTestConfig,
  seedApprovedPublicShareDocument,
} from './shift-batch-document-share-test.util';

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
  centreId: '44444444-4444-4444-8444-444444444401',
  opsUser: '44444444-4444-4444-8444-444444444402',
  contactId: '44444444-4444-4444-8444-444444444403',
  staffA: '44444444-4444-4444-8444-444444444404',
  staffB: '44444444-4444-4444-8444-444444444405',
};

describe.runIf(POSTGRES_READY)('Batch update confirmation integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let shiftsService: ShiftsService;
  let batchesService: ShiftBatchesService;
  let completionService: ShiftBatchCompletionService;
  let updateService: ShiftBatchUpdateConfirmationService;
  let changeHistory: ShiftBatchChangeHistoryService;
  let feedService: ShiftsFeedService;
  const batchIds: string[] = [];
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 6 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);

    const config = createBatchDocumentShareTestConfig();

    const { StaffDocumentShareService } = await import('../staff-documents/staff-document-share.service');
    const { StaffDocumentShareLifecycleService } = await import(
      '../staff-documents/staff-document-share-lifecycle.service'
    );

    const shareService = new StaffDocumentShareService(config);
    const shareLifecycle = new StaffDocumentShareLifecycleService(
      db,
      shareService,
      { record: vi.fn() } as never,
      config,
    );
    const platformAudit = new PlatformAuditService(db);
    const scheduled = new ScheduledCommunicationsService(db);
    const automated = new AutomatedCommunicationsService(scheduled, {
      enqueue: vi.fn(),
      syncJobSchedule: vi.fn(),
      ensureJobExists: vi.fn(),
    } as never);

    shiftsService = createIntegrationShiftsService(db);
    changeHistory = new ShiftBatchChangeHistoryService(db);
    const readiness = new ShiftBatchCompletionReadinessService(db, shareLifecycle);
    completionService = new ShiftBatchCompletionService(
      db,
      automated,
      platformAudit,
      readiness,
      shareLifecycle,
    );
    updateService = new ShiftBatchUpdateConfirmationService(
      db,
      automated,
      platformAudit,
      changeHistory,
      shareLifecycle,
    );
    batchesService = new ShiftBatchesService(
      db,
      shiftsService,
      createMockShiftBatchProgressCommunicationService(),
      readiness,
      completionService,
      updateService,
      { getBatchActivity: vi.fn() } as never,
    );
    feedService = new ShiftsFeedService(db);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-update@example.test',
      fullName: 'Update Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Update Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(centreContacts).values({
      id: FIXTURE.contactId,
      centreId: FIXTURE.centreId,
      name: 'Primary',
      email: 'primary@update.example.test',
      sortOrder: 0,
    });

    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalName: 'Carer Alpha',
        email: 'alpha@example.test',
        role: 'ECE',
        status: 'active',
        documentSlug: 'carer-alpha',
      },
      {
        id: FIXTURE.staffB,
        legalName: 'Carer Beta',
        email: 'beta@example.test',
        role: 'ECE',
        status: 'active',
        documentSlug: 'carer-beta',
      },
    ]);

    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffB);
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) {
      await db.delete(scheduledCommunications).where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await clearStaffPublicShareDocuments(db, FIXTURE.staffB);
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  async function createConfirmedBatch(shiftDates: string[]) {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreId,
        shifts: shiftDates.map((date) => ({
          shiftDate: date,
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECE' as const,
        })),
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    for (const child of created.created) {
      await assignContactedStaffForIntegration(
        shiftsService,
        child.id,
        FIXTURE.staffA,
        FIXTURE.opsUser,
      );
    }

    const confirmedAt = new Date();
    await db
      .update(shiftBatches)
      .set({
        requestCompletedAt: confirmedAt,
        requestCompletedByUserId: FIXTURE.opsUser,
        confirmationRevision: 1,
        pendingChangeRevision: 0,
        lastConfirmationScheduledAt: confirmedAt,
      })
      .where(eq(shiftBatches.id, created.batch.id));

    return created;
  }

  it('sends update confirmation once and is idempotent for the same stale revision', async () => {
    const created = await createConfirmedBatch(['2029-01-01']);
    const childId = created.created[0]!.id;

    await shiftsService.update(childId, { confirmationNotes: 'Updated note' }, FIXTURE.opsUser);

    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    expect(readiness.ready).toBe(true);
    expect(readiness.pendingChangeRevision).toBeGreaterThan(0);
    const changeIds = readiness.detectedChanges.map((c) => c.id);

    const first = await updateService.scheduleUpdate(
      created.batch.id,
      FIXTURE.opsUser,
      changeIds,
      readiness.pendingChangeRevision,
    );
    const second = await updateService.scheduleUpdate(
      created.batch.id,
      FIXTURE.opsUser,
      changeIds,
      readiness.pendingChangeRevision,
    );

    expect(first.scheduledCommunicationId).toBeTruthy();
    expect(second.scheduledCommunicationId).toBe(first.scheduledCommunicationId);

    const commRows = await db
      .select()
      .from(scheduledCommunications)
      .where(
        eq(
          scheduledCommunications.idempotencyKey,
          buildBatchConfirmationRevisionIdempotencyKey(created.batch.id, 2),
        ),
      );
    expect(commRows).toHaveLength(1);

    const batchRow = await db
      .select()
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);
    expect(batchRow[0]?.confirmationRevision).toBe(2);
    expect(batchRow[0]?.pendingChangeRevision).toBe(0);
  });

  it('rejects update confirmation when readiness becomes stale before submit', async () => {
    const created = await createConfirmedBatch(['2029-02-01']);
    const childId = created.created[0]!.id;

    await shiftsService.update(childId, { confirmationNotes: 'First change' }, FIXTURE.opsUser);
    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    expect(readiness.ready).toBe(true);

    await shiftsService.unassign(childId, FIXTURE.opsUser);

    await expect(
      updateService.scheduleUpdate(
        created.batch.id,
        FIXTURE.opsUser,
        readiness.detectedChanges.map((c) => c.id),
        readiness.pendingChangeRevision,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const updateComms = await db
      .select()
      .from(scheduledCommunications)
      .where(
        eq(
          scheduledCommunications.idempotencyKey,
          buildBatchConfirmationRevisionIdempotencyKey(created.batch.id, 2),
        ),
      );
    expect(updateComms).toHaveLength(0);
  });

  it('rejects update when unseen material change occurred after dialog opened', async () => {
    const created = await createConfirmedBatch(['2029-03-01']);
    const childId = created.created[0]!.id;

    await shiftsService.update(childId, { confirmationNotes: 'First change' }, FIXTURE.opsUser);
    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    const seenPendingRevision = readiness.pendingChangeRevision;

    await shiftsService.update(childId, { roleNeeded: 'ECA' }, FIXTURE.opsUser);

    await expect(
      updateService.scheduleUpdate(
        created.batch.id,
        FIXTURE.opsUser,
        readiness.detectedChanges.map((c) => c.id),
        seenPendingRevision,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('coalesces date changes A→B→C into A→C in change summary', async () => {
    const created = await createConfirmedBatch(['2029-04-01']);
    const childId = created.created[0]!.id;

    await shiftsService.update(childId, { shiftDate: '2029-04-02' }, FIXTURE.opsUser);
    await shiftsService.update(childId, { shiftDate: '2029-04-03' }, FIXTURE.opsUser);

    const batch = await db
      .select({
        lastConfirmationScheduledAt: shiftBatches.lastConfirmationScheduledAt,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        pendingChangeRevision: shiftBatches.pendingChangeRevision,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);
    expect(batch[0]?.pendingChangeRevision).toBeGreaterThan(0);

    const changes = await changeHistory.getDetectedChanges({
      batchId: created.batch.id,
      since: batch[0]?.requestCompletedAt ?? batch[0]?.lastConfirmationScheduledAt ?? null,
    });
    expect(changes.length).toBeGreaterThan(0);
    const dateChange = changes.find((c) => c.type === 'date_changed');
    expect(dateChange?.label).toContain('2029-04-01');
    expect(dateChange?.label).toContain('2029-04-03');
    expect(dateChange?.label).not.toContain('2029-04-02');
  });

  it('records confirmation outdated once while batch remains stale', async () => {
    const created = await createConfirmedBatch(['2029-05-01']);
    const childId = created.created[0]!.id;

    await shiftsService.update(childId, { confirmationNotes: 'Change 1' }, FIXTURE.opsUser);
    await shiftsService.update(childId, { confirmationNotes: 'Change 2' }, FIXTURE.opsUser);

    const events = await db
      .select({ action: platformAuditEvents.action })
      .from(platformAuditEvents)
      .where(
        and(
          eq(platformAuditEvents.entityId, created.batch.id),
          eq(platformAuditEvents.action, PLATFORM_AUDIT_ACTIONS.batchConfirmationOutdated),
        ),
      );
    expect(events).toHaveLength(1);
  });

  it('includes cancellation in change summary and restores feed to completed after update', async () => {
    const created = await createConfirmedBatch(['2029-06-01', '2029-06-02']);
    const [childA, childB] = created.created;

    await shiftsService.changeStatus(
      childA!.id,
      { status: 'cancelled', cancellationReason: 'No longer needed.' },
      FIXTURE.opsUser,
    );

    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    expect(readiness.ready).toBe(true);
    expect(readiness.detectedChanges.some((c) => c.label.includes('Shift cancelled'))).toBe(true);

    await updateService.scheduleUpdate(
      created.batch.id,
      FIXTURE.opsUser,
      readiness.detectedChanges.map((c) => c.id),
      readiness.pendingChangeRevision,
    );

    const feed = await feedService.feed({
      centreId: FIXTURE.centreId,
      from: '2029-06-01',
      to: '2029-06-30',
      page: 1,
      pageSize: 25,
    });
    const item = feed.items.find(
      (row) => row.type === 'batch' && row.batch.id === created.batch.id,
    );
    expect(item?.type === 'batch' && item.batch.displayState).toBe('completed');

    const workspace = await batchesService.getWorkspace(created.batch.id);
    expect(workspace.confirmationUiState).toBe('completed');
    expect(workspace.shifts.filter((s) => s.status !== 'cancelled')).toHaveLength(1);
  });

  it('shows actual Carer names for replacement after confirmation', async () => {
    const created = await createConfirmedBatch(['2029-08-01']);
    const childId = created.created[0]!.id;

    await assignContactedStaffForIntegration(
      shiftsService,
      childId,
      FIXTURE.staffB,
      FIXTURE.opsUser,
    );

    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    const carerChange = readiness.detectedChanges.find((c) => c.type === 'carer_changed');
    expect(carerChange?.label).toContain('Carer Alpha');
    expect(carerChange?.label).toContain('Carer Beta');
    expect(carerChange?.label).not.toContain('previous Carer');
  });

  it('unassign then reassign moves feed through updates_required to ready_to_send_updates', async () => {
    const created = await createConfirmedBatch(['2029-07-01']);
    const childId = created.created[0]!.id;

    await shiftsService.unassign(childId, FIXTURE.opsUser);
    let workspace = await batchesService.getWorkspace(created.batch.id);
    expect(workspace.confirmationUiState).toBe('updates_required');

    await assignContactedStaffForIntegration(
      shiftsService,
      childId,
      FIXTURE.staffB,
      FIXTURE.opsUser,
    );
    workspace = await batchesService.getWorkspace(created.batch.id);
    expect(workspace.confirmationUiState).toBe('ready_to_send_updates');
  });
});
