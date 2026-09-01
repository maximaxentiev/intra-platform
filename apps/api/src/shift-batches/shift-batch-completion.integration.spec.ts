import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
  users,
} from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { StaffDocumentShareService } from '../staff-documents/staff-document-share.service';
import { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import { buildBatchConfirmationFinalIdempotencyKey } from './shift-batch-completion.types';
import { buildBatchProgress70IdempotencyKey } from './shift-batch-progress.types';
import { ShiftBatchProgressCommunicationService } from './shift-batch-progress-communication.service';

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
  centreId: '66666666-6666-4666-8666-666666666601',
  opsUser: '66666666-6666-4666-8666-666666666602',
  contactId: '66666666-6666-4666-8666-666666666603',
  staffId: '66666666-6666-4666-8666-666666666604',
};

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';

describe.runIf(POSTGRES_READY)('Batch completion integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let completionService: ShiftBatchCompletionService;
  let progressService: ShiftBatchProgressCommunicationService;
  const batchIds: string[] = [];
  const documentSetIds: string[] = [];

  async function seedShareableDocument(staffId: string) {
    const setRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId,
        documentType: 'vulnerable_sector_check',
        remindersEnabled: true,
      })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;
    documentSetIds.push(setId);

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        submittedAt: new Date('2026-01-01T10:00:00.000Z'),
        submittedByActorType: 'ops_user',
      })
      .returning({ id: staffDocumentSubmissions.id });

    await db.insert(staffDocumentFiles).values({
      submissionId: submissionRows[0]!.id,
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `test/${staffId}/vsc.pdf`,
    });

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: submissionRows[0]!.id })
      .where(eq(staffDocumentSets.id, setId));
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);

    const config = {
      get: (key: string) => {
        if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return TEST_SIGNING_SECRET;
        if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
        if (key === 'APP_HOST') return 'platform.intra.ca';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      },
      getOrThrow: (key: string) => {
        const value = key === 'DOCUMENT_SHARE_SIGNING_SECRET' ? TEST_SIGNING_SECRET : undefined;
        if (!value) throw new Error(`missing ${key}`);
        return value;
      },
    } as ConfigService;

    const shareService = new StaffDocumentShareService(config);
    const generated = shareService.generateShareTokenState(FIXTURE.staffId, new Date('2026-08-01T12:00:00Z'));
    const shareLifecycle = new StaffDocumentShareLifecycleService(
      db,
      shareService,
      { record: vi.fn() } as unknown as StaffPortalAuditService,
      config,
    );
    const readiness = new ShiftBatchCompletionReadinessService(db, shareLifecycle);
    const scheduled = new ScheduledCommunicationsService(db);
    const automated = new AutomatedCommunicationsService(scheduled, {
      enqueue: vi.fn(),
      syncJobSchedule: vi.fn(),
      ensureJobExists: vi.fn(),
    } as never);
    completionService = new ShiftBatchCompletionService(
      db,
      automated,
      new PlatformAuditService(db),
      readiness,
      shareLifecycle,
    );
    progressService = new ShiftBatchProgressCommunicationService(
      db,
      automated,
      new PlatformAuditService(db),
    );

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-completion@example.test',
      fullName: 'Batch Completion Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Completion Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(centreContacts).values({
      id: FIXTURE.contactId,
      centreId: FIXTURE.centreId,
      name: 'Primary',
      email: 'primary@completion.example.test',
      sortOrder: 0,
    });
    await db.insert(staff).values({
      id: FIXTURE.staffId,
      legalName: 'Jane Smith',
      displayName: 'Jane Smith',
      useDisplayName: true,
      email: 'jane@example.test',
      status: 'active',
      documentSlug: 'jane-smith',
      documentShareTokenHash: generated.hash,
      documentShareTokenCreatedAt: generated.createdAt,
      documentShareTokenRevokedAt: null,
    });
    await seedShareableDocument(FIXTURE.staffId);
  });

  afterAll(async () => {
    if (batchIds.length) {
      await db.delete(shifts).where(inArray(shifts.batchId, batchIds));
      await db.delete(scheduledCommunications).where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    if (documentSetIds.length) {
      const submissionRows = await db
        .select({ id: staffDocumentSubmissions.id })
        .from(staffDocumentSubmissions)
        .where(inArray(staffDocumentSubmissions.documentSetId, documentSetIds));
      const submissionIds = submissionRows.map((row) => row.id);
      if (submissionIds.length) {
        await db
          .delete(staffDocumentFiles)
          .where(inArray(staffDocumentFiles.submissionId, submissionIds));
        await db
          .delete(staffDocumentSubmissions)
          .where(inArray(staffDocumentSubmissions.id, submissionIds));
      }
      await db.delete(staffDocumentSets).where(inArray(staffDocumentSets.id, documentSetIds));
    }
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  async function createReadyBatch() {
    const batchRows = await db
      .insert(shiftBatches)
      .values({ centreId: FIXTURE.centreId, createdByUserId: FIXTURE.opsUser })
      .returning({ id: shiftBatches.id });
    const batchId = batchRows[0]!.id;
    batchIds.push(batchId);

    for (let i = 0; i < 3; i++) {
      await db.insert(shifts).values({
        centreId: FIXTURE.centreId,
        batchId,
        shiftDate: '2026-09-10',
        startTime: `${8 + i}:00:00`,
        endTime: `${16 + i}:00:00`,
        roleNeeded: 'ECE',
        status: 'filled',
        assignedStaffId: FIXTURE.staffId,
      });
    }

    return batchId;
  }

  it('completes once and is idempotent on repeated complete calls', async () => {
    const batchId = await createReadyBatch();

    const first = await completionService.complete(batchId, FIXTURE.opsUser);
    const second = await completionService.complete(batchId, FIXTURE.opsUser);

    expect(first.completed).toBe(true);
    expect(second.completed).toBe(true);
    expect(first.scheduledCommunicationId).toBeTruthy();
    expect(second.scheduledCommunicationId).toBe(first.scheduledCommunicationId);

    const batch = await db
      .select({ requestCompletedAt: shiftBatches.requestCompletedAt })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId));
    expect(batch[0]?.requestCompletedAt).toBeTruthy();

    const commRows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, buildBatchConfirmationFinalIdempotencyKey(batchId)));
    expect(commRows).toHaveLength(1);
  });

  it('cancels unsent progress email when completing the batch', async () => {
    const batchRows = await db
      .insert(shiftBatches)
      .values({ centreId: FIXTURE.centreId, createdByUserId: FIXTURE.opsUser })
      .returning({ id: shiftBatches.id });
    const batchId = batchRows[0]!.id;
    batchIds.push(batchId);

    for (let i = 0; i < 10; i++) {
      await db.insert(shifts).values({
        centreId: FIXTURE.centreId,
        batchId,
        shiftDate: '2026-09-11',
        startTime: `${8 + (i % 3)}:00:00`,
        endTime: `${16 + (i % 3)}:00:00`,
        roleNeeded: 'ECE',
        status: i < 7 ? 'filled' : 'pending',
        assignedStaffId: i < 7 ? FIXTURE.staffId : null,
      });
    }

    await progressService.evaluateAndSchedule(batchId);

    await db
      .update(shifts)
      .set({ status: 'filled', assignedStaffId: FIXTURE.staffId })
      .where(eq(shifts.batchId, batchId));

    await completionService.complete(batchId, FIXTURE.opsUser);

    const progressComm = await db
      .select({ status: scheduledCommunications.status })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, buildBatchProgress70IdempotencyKey(batchId)));
    expect(progressComm[0]?.status).toBe('cancelled');
  });

  it('rejects completion when an active child becomes unassigned', async () => {
    const batchId = await createReadyBatch();
    const readiness = await completionService['readiness'].getReadiness(batchId);
    expect(readiness.ready).toBe(true);

    const child = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.batchId, batchId))
      .limit(1);
    await db
      .update(shifts)
      .set({ assignedStaffId: null, status: 'pending' })
      .where(eq(shifts.id, child[0]!.id));

    await expect(completionService.complete(batchId, FIXTURE.opsUser)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const batch = await db
      .select({ requestCompletedAt: shiftBatches.requestCompletedAt })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId));
    expect(batch[0]?.requestCompletedAt).toBeNull();
  });
});

describe.runIf(!POSTGRES_READY)('Batch completion integration', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
