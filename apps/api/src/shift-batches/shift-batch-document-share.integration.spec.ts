import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
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
  users,
} from '../db/schema';
import { EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import {
  assignContactedStaffForIntegration,
  createIntegrationShiftsService,
} from '../shifts/shifts-integration-test.util';
import { ShiftAssignmentConfirmationService } from '../shifts/shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from '../shifts/shift-assignment-notifications.service';
import { ShiftCommunicationPolicyService } from '../shifts/shift-communication-policy.service';
import type { ShiftsService } from '../shifts/shifts.service';
import {
  buildActiveStaffDocumentShareUrlForEmail,
  ensureFreshStaffDocumentShareUrlForCentreEmail,
} from '../staff-documents/staff-document-share-email.util';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { StaffDocumentShareService } from '../staff-documents/staff-document-share.service';
import { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { BatchConfirmationFinalCommunicationProcessor } from './shift-batch-confirmation-final.processor';
import { BatchConfirmationUpdateCommunicationProcessor } from './shift-batch-confirmation-update.processor';
import {
  assertDocumentShareUrlValid,
  clearStaffPublicShareDocuments,
  createBatchDocumentShareTestConfig,
  revokeStaffDocumentShare,
  resetStaffDocumentShareState,
  seedApprovedPublicShareDocument,
} from './shift-batch-document-share-test.util';
import { ShiftBatchChangeHistoryService } from './shift-batch-change-history.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import { ShiftBatchUpdateConfirmationService } from './shift-batch-update-confirmation.service';
import { ShiftBatchesService } from './shift-batches.service';
import { createMockShiftBatchProgressCommunicationService } from './shift-batch-progress-test.util';

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
  contactId: '55555555-5555-4555-8555-555555555503',
  staffA: '55555555-5555-4555-8555-555555555504',
  staffB: '55555555-5555-4555-8555-555555555505',
  staffC: '55555555-5555-4555-8555-555555555506',
  staffNoDocs: '55555555-5555-4555-8555-555555555507',
};

describe.runIf(POSTGRES_READY)('Batch document share integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let config: ConfigService;
  let shareService: StaffDocumentShareService;
  let shareLifecycle: StaffDocumentShareLifecycleService;
  let shiftsService: ShiftsService;
  let batchesService: ShiftBatchesService;
  let completionService: ShiftBatchCompletionService;
  let updateService: ShiftBatchUpdateConfirmationService;
  let changeHistory: ShiftBatchChangeHistoryService;
  let finalProcessor: BatchConfirmationFinalCommunicationProcessor;
  let updateProcessor: BatchConfirmationUpdateCommunicationProcessor;
  let assignmentConfirmation: ShiftAssignmentConfirmationService;
  let emailTransport: RecordingEmailTransport;

  const batchIds: string[] = [];
  const shiftIds: string[] = [];

  async function insertStaff(input: {
    id: string;
    legalName: string;
    documentSlug: string;
    withActiveShare?: boolean;
  }) {
    const shareState =
      input.withActiveShare === false
        ? {
            documentShareTokenHash: null,
            documentShareTokenCreatedAt: null,
            documentShareTokenRevokedAt: null,
          }
        : (() => {
            const generated = shareService.generateShareTokenState(
              input.id,
              new Date('2026-08-01T12:00:00Z'),
            );
            return {
              documentShareTokenHash: generated.hash,
              documentShareTokenCreatedAt: generated.createdAt,
              documentShareTokenRevokedAt: null,
            };
          })();

    await db.insert(staff).values({
      id: input.id,
      legalName: input.legalName,
      email: `${input.documentSlug}@example.test`,
      role: 'ECE',
      status: 'active',
      documentSlug: input.documentSlug,
      ...shareState,
    });
  }

  async function createFilledBatch(shiftDates: string[], assignStaffId = FIXTURE.staffA) {
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
        assignStaffId,
        FIXTURE.opsUser,
      );
    }

    return created;
  }

  async function markBatchConfirmed(batchId: string) {
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
      .where(eq(shiftBatches.id, batchId));
    return confirmedAt;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 6 });
    db = drizzle(pool, { schema });
    config = createBatchDocumentShareTestConfig();
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);

    shareService = new StaffDocumentShareService(config);
    shareLifecycle = new StaffDocumentShareLifecycleService(
      db,
      shareService,
      { record: vi.fn() } as unknown as StaffPortalAuditService,
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

    finalProcessor = new BatchConfirmationFinalCommunicationProcessor(config);
    updateProcessor = new BatchConfirmationUpdateCommunicationProcessor(config);

    emailTransport = new RecordingEmailTransport();
    const email = new EmailService(config);
    email.useTransport(emailTransport);
    assignmentConfirmation = new ShiftAssignmentConfirmationService(
      db,
      email,
      config,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as ShiftAssignmentNotificationsService,
      shareLifecycle,
      {
        resolveForShift: vi.fn().mockResolvedValue({
          batchId: null,
          batchRequestCompleted: false,
          batchConfirmationStale: false,
          centreCommunicationDeferred: false,
          centreDeferReason: null,
        }),
      } as unknown as ShiftCommunicationPolicyService,
    );

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreId));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db
      .delete(staff)
      .where(
        inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB, FIXTURE.staffC, FIXTURE.staffNoDocs]),
      );
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'batch-doc-share@example.test',
      fullName: 'Doc Share Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Document Share Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(centreContacts).values({
      id: FIXTURE.contactId,
      centreId: FIXTURE.centreId,
      name: 'Primary',
      email: 'primary@docshare.example.test',
      sortOrder: 0,
    });

    await insertStaff({
      id: FIXTURE.staffA,
      legalName: 'Carer Alpha',
      documentSlug: 'docshare-alpha',
      withActiveShare: false,
    });
    await insertStaff({
      id: FIXTURE.staffB,
      legalName: 'Carer Beta',
      documentSlug: 'docshare-beta',
      withActiveShare: false,
    });
    await insertStaff({
      id: FIXTURE.staffC,
      legalName: 'Carer Gamma',
      documentSlug: 'docshare-gamma',
      withActiveShare: false,
    });
    await insertStaff({
      id: FIXTURE.staffNoDocs,
      legalName: 'Carer No Docs',
      documentSlug: 'docshare-no-docs',
      withActiveShare: false,
    });
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) {
      await db
        .delete(scheduledCommunications)
        .where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    for (const staffId of [FIXTURE.staffA, FIXTURE.staffB, FIXTURE.staffC, FIXTURE.staffNoDocs]) {
      await clearStaffPublicShareDocuments(db, staffId);
    }
    await db
      .delete(staff)
      .where(
        inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB, FIXTURE.staffC, FIXTURE.staffNoDocs]),
      );
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  it('generates a valid share URL when documents exist but no active share', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    const readiness = await shareLifecycle.assessDocumentShareReadiness(FIXTURE.staffA);
    expect(readiness).toEqual({ ready: true, mode: 'generatable' });

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db,
      config,
      FIXTURE.staffA,
      FIXTURE.opsUser,
    );
    expect(url).toBeTruthy();
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, url!);
    expect(url).toContain('https://platform.intra.ca/documents/docshare-alpha#');
  });

  it('refreshes a revoked stale share instead of reusing the old URL', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    const generated = await shareLifecycle.generateShareLink(FIXTURE.staffA, FIXTURE.opsUser);
    const staleUrl = generated.shareUrl;

    await revokeStaffDocumentShare(db, FIXTURE.staffA);

    expect(await buildActiveStaffDocumentShareUrlForEmail(db, config, FIXTURE.staffA)).toBeNull();

    const freshUrl = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db,
      config,
      FIXTURE.staffA,
      FIXTURE.opsUser,
    );

    expect(freshUrl).toBeTruthy();
    expect(freshUrl).not.toBe(staleUrl);
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, freshUrl!);
  });

  it('blocks Centre share when no qualifying approved documents exist', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffNoDocs);

    const readiness = await shareLifecycle.assessDocumentShareReadiness(FIXTURE.staffNoDocs);
    expect(readiness.ready).toBe(false);

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db,
      config,
      FIXTURE.staffNoDocs,
      FIXTURE.opsUser,
    );
    expect(url).toBeNull();
  });

  it('blocks Centre share when documents were removed while a token remains active', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);
    await shareLifecycle.generateShareLink(FIXTURE.staffA, FIXTURE.opsUser);

    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);

    const readiness = await shareLifecycle.assessDocumentShareReadiness(FIXTURE.staffA);
    expect(readiness.ready).toBe(false);

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db,
      config,
      FIXTURE.staffA,
      FIXTURE.opsUser,
    );
    expect(url).toBeNull();
  });

  it('blocks batch final confirmation delivery when document share cannot be produced', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffNoDocs);
    const created = await createFilledBatch(['2029-10-01'], FIXTURE.staffNoDocs);

    await expect(completionService.complete(created.batch.id, FIXTURE.opsUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('delivers initial batch confirmation with one working share URL per unique Carer', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    const created = await createFilledBatch(['2029-11-01', '2029-11-02']);
    const completed = await completionService.complete(created.batch.id, FIXTURE.opsUser);
    expect(completed.scheduledCommunicationId).toBeTruthy();

    const outcome = await finalProcessor.evaluate(db, {
      scheduledCommunicationId: completed.scheduledCommunicationId!,
      recipientEntityId: FIXTURE.centreId,
    });
    expect(outcome.kind).toBe('valid');
    if (outcome.kind !== 'valid') return;

    const urlMatches = outcome.text.match(/https:\/\/platform\.intra\.ca\/documents\/[^\s]+/g) ?? [];
    expect(urlMatches.length).toBe(2);
    expect(urlMatches[0]).toBe(urlMatches[1]);
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, urlMatches[0]!);
  });

  it('delivers batch update confirmation with a fresh URL after the prior share was revoked', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    const created = await createFilledBatch(['2029-12-01']);
    await markBatchConfirmed(created.batch.id);

    const initialShare = await shareLifecycle.generateShareLink(FIXTURE.staffA, FIXTURE.opsUser);
    const revisionOneUrl = initialShare.shareUrl;

    await shiftsService.update(
      created.created[0]!.id,
      { confirmationNotes: 'Updated after confirmation' },
      FIXTURE.opsUser,
    );
    await revokeStaffDocumentShare(db, FIXTURE.staffA);

    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    expect(readiness.ready).toBe(true);

    const scheduled = await updateService.scheduleUpdate(
      created.batch.id,
      FIXTURE.opsUser,
      readiness.detectedChanges.map((change) => change.id),
      readiness.pendingChangeRevision,
    );

    const outcome = await updateProcessor.evaluate(db, {
      scheduledCommunicationId: scheduled.scheduledCommunicationId!,
      recipientEntityId: FIXTURE.centreId,
    });
    expect(outcome.kind).toBe('valid');
    if (outcome.kind !== 'valid') return;

    expect(outcome.text).not.toContain(revisionOneUrl);
    const urlMatches = outcome.text.match(/https:\/\/platform\.intra\.ca\/documents\/[^\s]+/g) ?? [];
    expect(urlMatches.length).toBeGreaterThan(0);
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, urlMatches[0]!);
  });

  it('protects individual Centre assignment confirmations with fresh share URLs', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    const generated = await shareLifecycle.generateShareLink(FIXTURE.staffA, FIXTURE.opsUser);
    await revokeStaffDocumentShare(db, FIXTURE.staffA);

    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId: FIXTURE.centreId,
        shiftDate: '2029-12-15',
        startTime: '09:00:00',
        endTime: '17:00:00',
        roleNeeded: 'ECE',
        status: 'filled',
        assignedStaffId: FIXTURE.staffA,
      })
      .returning({ id: shifts.id });
    shiftIds.push(shiftRows[0]!.id);

    emailTransport.sent = [];
    const result = await assignmentConfirmation.sendAssignmentConfirmations({
      shiftId: shiftRows[0]!.id,
      assignedStaffId: FIXTURE.staffA,
      actorUserId: FIXTURE.opsUser,
      trigger: 'assign',
    });

    expect(result.centre.sent).toBe(true);
    const centreEmail = emailTransport.sent.find(
      (message) => message.to === 'primary@docshare.example.test',
    );
    expect(centreEmail?.text).toBeTruthy();
    expect(centreEmail?.text).not.toContain(generated.shareUrl);

    const urlMatches = centreEmail!.text!.match(/https:\/\/platform\.intra\.ca\/documents\/[^\s]+/g) ?? [];
    expect(urlMatches.length).toBeGreaterThan(0);
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, urlMatches[0]!);
  });

  it('does not depend on pre-existing document residue for the same Carer fixture', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await resetStaffDocumentShareState(db, FIXTURE.staffA);

    let readiness = await shareLifecycle.assessDocumentShareReadiness(FIXTURE.staffA);
    expect(readiness.ready).toBe(false);

    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);

    readiness = await shareLifecycle.assessDocumentShareReadiness(FIXTURE.staffA);
    expect(readiness).toEqual({ ready: true, mode: 'generatable' });

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db,
      config,
      FIXTURE.staffA,
      FIXTURE.opsUser,
    );
    expect(url).toBeTruthy();
    await assertDocumentShareUrlValid(db, config, FIXTURE.staffA, url!);
  });

  it('coalesces carer replacement A→B→C into one change from A to C', async () => {
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await clearStaffPublicShareDocuments(db, FIXTURE.staffB);
    await clearStaffPublicShareDocuments(db, FIXTURE.staffC);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffB);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffC);

    const created = await createFilledBatch(['2029-12-20']);
    const childId = created.created[0]!.id;
    await markBatchConfirmed(created.batch.id);

    await assignContactedStaffForIntegration(
      shiftsService,
      childId,
      FIXTURE.staffB,
      FIXTURE.opsUser,
    );
    await assignContactedStaffForIntegration(
      shiftsService,
      childId,
      FIXTURE.staffC,
      FIXTURE.opsUser,
    );

    const batch = await db
      .select({ lastConfirmationScheduledAt: shiftBatches.lastConfirmationScheduledAt })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, created.batch.id))
      .limit(1);

    const changes = await changeHistory.getDetectedChanges({
      batchId: created.batch.id,
      since: batch[0]?.lastConfirmationScheduledAt ?? null,
    });

    const carerChanges = changes.filter((change) => change.type === 'carer_changed');
    expect(carerChanges).toHaveLength(1);
    expect(carerChanges[0]?.label).toBe('Carer changed from Carer Alpha to Carer Gamma');
    expect(carerChanges[0]?.label).not.toContain('Carer Beta');
  });
});

describe.runIf(!POSTGRES_READY)('Batch document share integration', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
