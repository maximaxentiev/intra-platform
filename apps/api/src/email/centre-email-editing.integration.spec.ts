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
  users,
} from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import {
  assignContactedStaffForIntegration,
} from '../shifts/shifts-integration-test.util';
import { ShiftAssignmentConfirmationService } from '../shifts/shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from '../shifts/shift-assignment-notifications.service';
import { ShiftCommunicationPolicyService } from '../shifts/shift-communication-policy.service';
import { ShiftMatchingService } from '../shifts/shift-matching.service';
import { ShiftsService } from '../shifts/shifts.service';
import { createMockShiftReminderService } from '../shifts/shift-reminder-test.util';
import { createMockShiftCancellationService } from '../shifts/shift-cancellation-test.util';
import { createMockShiftUpdateCommunicationService } from '../shifts/shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from '../shifts/shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { ShiftBatchStalenessService } from '../shift-batches/shift-batch-staleness.service';
import { ShiftBatchChangeHistoryService } from '../shift-batches/shift-batch-change-history.service';
import { ShiftBatchCompletionReadinessService } from '../shift-batches/shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from '../shift-batches/shift-batch-completion.service';
import { ShiftBatchUpdateConfirmationService } from '../shift-batches/shift-batch-update-confirmation.service';
import { ShiftBatchesService } from '../shift-batches/shift-batches.service';
import { BatchConfirmationFinalCommunicationProcessor } from '../shift-batches/shift-batch-confirmation-final.processor';
import {
  createBatchDocumentShareTestConfig,
  seedApprovedPublicShareDocument,
  clearStaffPublicShareDocuments,
  revokeStaffDocumentShare,
  assertDocumentShareUrlValid,
} from '../shift-batches/shift-batch-document-share-test.util';
import { EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { buildCentreEmailSecureDocMarker } from './centre-email-body.util';

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
  staffA: '66666666-6666-4666-8666-666666666604',
  batchCentreId: '77777777-7777-4777-8777-777777777701',
  batchOpsUser: '77777777-7777-4777-8777-777777777702',
  batchContactId: '77777777-7777-4777-8777-777777777703',
  batchStaffA: '77777777-7777-4777-8777-777777777704',
};

describe.runIf(POSTGRES_READY)('Centre email editing integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let config: ConfigService;
  let shiftsService: ShiftsService;
  let emailTransport: RecordingEmailTransport;
  let batchesService: ShiftBatchesService;
  let completionService: ShiftBatchCompletionService;
  let updateService: ShiftBatchUpdateConfirmationService;
  let finalProcessor: BatchConfirmationFinalCommunicationProcessor;
  const shiftIds: string[] = [];
  const batchIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 8 });
    db = drizzle(pool, { schema });
    config = createBatchDocumentShareTestConfig();
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shift_assignment_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id uuid NOT NULL,
        assigned_staff_id uuid NOT NULL,
        recipient_type text NOT NULL,
        trigger text NOT NULL,
        status text NOT NULL,
        recipient_email text NOT NULL DEFAULT '',
        provider_id text,
        failure_code text,
        failure_reason text,
        actor_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz
      );
    `).catch(() => undefined);

    emailTransport = new RecordingEmailTransport();
    const email = new EmailService(config);
    email.useTransport(emailTransport);

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
    const assignmentNotifications = new ShiftAssignmentNotificationsService(db);
    const communicationPolicy = {
      resolveForShift: vi.fn().mockResolvedValue({
        batchId: null,
        batchRequestCompleted: false,
        batchConfirmationStale: false,
        centreCommunicationDeferred: false,
        centreDeferReason: null,
      }),
    } as unknown as ShiftCommunicationPolicyService;

    const assignmentConfirmation = new ShiftAssignmentConfirmationService(
      db,
      email,
      config,
      assignmentNotifications,
      shareLifecycle,
      communicationPolicy,
    );

    const shiftMatching = new ShiftMatchingService(db);
    vi.spyOn(shiftMatching, 'evaluateStaffForShift').mockResolvedValue({
      eligible: true,
      reasons: [],
    });

    shiftsService = new ShiftsService(
      db,
      assignmentConfirmation,
      shiftMatching,
      createMockShiftReminderService(),
      createMockShiftCancellationService(),
      platformAudit,
      createMockShiftUpdateCommunicationService(),
      createMockShiftManualUnassignCommunicationService(),
      createMockShiftBatchProgressCommunicationService() as never,
      new ShiftBatchStalenessService(db, platformAudit),
    );

    const scheduled = new ScheduledCommunicationsService(db);
    const automated = new AutomatedCommunicationsService(scheduled, {
      enqueue: vi.fn(),
      syncJobSchedule: vi.fn(),
      ensureJobExists: vi.fn(),
    } as never);
    const changeHistory = new ShiftBatchChangeHistoryService(db);
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

    for (const centreId of [FIXTURE.centreId, FIXTURE.batchCentreId]) {
      await db.delete(shifts).where(eq(shifts.centreId, centreId));
      await db.delete(shiftBatches).where(eq(shiftBatches.centreId, centreId));
      await db.delete(centreContacts).where(eq(centreContacts.centreId, centreId));
      await db.delete(centres).where(eq(centres.id, centreId));
    }
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.batchStaffA]));
    await db.delete(users).where(inArray(users.id, [FIXTURE.opsUser, FIXTURE.batchOpsUser]));

    await db.insert(users).values([
      {
        id: FIXTURE.opsUser,
        email: 'centre-email-ops@example.test',
        fullName: 'Centre Email Ops',
        role: 'admin',
        passwordHash: 'hash',
        isActive: true,
      },
      {
        id: FIXTURE.batchOpsUser,
        email: 'batch-email-ops@example.test',
        fullName: 'Batch Email Ops',
        role: 'admin',
        passwordHash: 'hash',
        isActive: true,
      },
    ]);

    await db.insert(centres).values([
      { id: FIXTURE.centreId, name: 'Immutability Centre', city: 'Toronto', status: 'active' },
      { id: FIXTURE.batchCentreId, name: 'Batch Stale Centre', city: 'Toronto', status: 'active' },
    ]);
    await db.insert(centreContacts).values([
      {
        id: FIXTURE.contactId,
        centreId: FIXTURE.centreId,
        name: 'Primary',
        email: 'primary@immutability.example.test',
        sortOrder: 0,
      },
      {
        id: FIXTURE.batchContactId,
        centreId: FIXTURE.batchCentreId,
        name: 'Primary',
        email: 'primary@batch-stale.example.test',
        sortOrder: 0,
      },
    ]);
    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalName: 'Carer Alpha',
        legalFirstName: 'Carer',
        legalLastName: 'Alpha',
        email: 'alpha@example.test',
        role: 'ECE',
        status: 'active',
        documentSlug: 'carer-alpha-immutability',
      },
      {
        id: FIXTURE.batchStaffA,
        legalName: 'Batch Carer Alpha',
        email: 'batch-alpha@example.test',
        role: 'ECE',
        status: 'active',
        documentSlug: 'batch-carer-alpha',
      },
    ]);
    await seedApprovedPublicShareDocument(db, FIXTURE.staffA);
    await seedApprovedPublicShareDocument(db, FIXTURE.batchStaffA);
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) {
      await db.delete(scheduledCommunications).where(inArray(scheduledCommunications.entityId, batchIds));
      await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    }
    await clearStaffPublicShareDocuments(db, FIXTURE.staffA);
    await clearStaffPublicShareDocuments(db, FIXTURE.batchStaffA);
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.batchStaffA]));
    await db.delete(centreContacts).where(inArray(centreContacts.centreId, [FIXTURE.centreId, FIXTURE.batchCentreId]));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreId, FIXTURE.batchCentreId]));
    await db.delete(users).where(inArray(users.id, [FIXTURE.opsUser, FIXTURE.batchOpsUser]));
    await pool.end();
  });

  it('does not mutate authoritative shift fields when centre email text is customized on assign', async () => {
    const created = await shiftsService.create(
      {
        centreId: FIXTURE.centreId,
        shiftDate: '2029-10-01',
        startTime: '08:30:00',
        endTime: '16:30:00',
        roleNeeded: 'ECE',
        confirmationNotes: 'AUTH_NOTES gate code 4455',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);

    const customBody = [
      'EMAIL_ONLY_TIME 11:00 AM – 7:00 PM',
      'EMAIL_ONLY_ROLE RECE Supervisor',
      'EMAIL_ONLY_CARER Beta Tester',
      'EMAIL_ONLY_NOTES different notes in email',
      buildCentreEmailSecureDocMarker(FIXTURE.staffA),
    ].join('\n');

    emailTransport.sent = [];
    await assignContactedStaffForIntegration(
      shiftsService,
      created.id,
      FIXTURE.staffA,
      FIXTURE.opsUser,
      {
        centreEmail: {
          subject: 'EMAIL_ONLY_SUBJECT Custom assign confirmation',
          body: customBody,
        },
      },
    );

    const centreEmail = emailTransport.sent.find((m) => m.to === 'primary@immutability.example.test');
    expect(centreEmail?.subject).toBe('EMAIL_ONLY_SUBJECT Custom assign confirmation');
    expect(centreEmail?.text).toContain('EMAIL_ONLY_TIME');
    expect(centreEmail?.text).not.toContain('8:30 AM');

    const shift = await shiftsService.get(created.id);
    expect(String(shift.shiftDate)).toBe('2029-10-01');
    expect(String(shift.startTime)).toMatch(/08:30/);
    expect(String(shift.endTime)).toMatch(/16:30/);
    expect(shift.roleNeeded).toBe('ECE');
    expect(shift.confirmationNotes).toBe('AUTH_NOTES gate code 4455');
    expect(shift.assignedStaffId).toBe(FIXTURE.staffA);
  });

  it('rejects stale customized batch update draft after material batch change', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.batchCentreId,
        shifts: [
          {
            shiftDate: '2029-11-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
        ],
      },
      FIXTURE.batchOpsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));
    const childId = created.created[0]!.id;

    for (const child of created.created) {
      await assignContactedStaffForIntegration(
        shiftsService,
        child.id,
        FIXTURE.batchStaffA,
        FIXTURE.batchOpsUser,
      );
    }

    const confirmedAt = new Date();
    await db
      .update(shiftBatches)
      .set({
        requestCompletedAt: confirmedAt,
        requestCompletedByUserId: FIXTURE.batchOpsUser,
        confirmationRevision: 1,
        pendingChangeRevision: 0,
        lastConfirmationScheduledAt: confirmedAt,
      })
      .where(eq(shiftBatches.id, created.batch.id));

    await shiftsService.update(childId, { confirmationNotes: 'Stale draft change' }, FIXTURE.batchOpsUser);
    const readiness = await updateService.getUpdateReadiness(created.batch.id);
    const staleRevision = readiness.pendingChangeRevision;
    const customBody = [
      'STALE_CUSTOM_BODY edited batch update wording',
      buildCentreEmailSecureDocMarker(FIXTURE.batchStaffA),
    ].join('\n');

    await shiftsService.update(childId, { roleNeeded: 'ECA' }, FIXTURE.batchOpsUser);

    await expect(
      updateService.scheduleUpdate(
        created.batch.id,
        FIXTURE.batchOpsUser,
        readiness.detectedChanges.map((change) => change.id),
        staleRevision,
        {
          subject: 'STALE_CUSTOM_SUBJECT',
          body: customBody,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const updateComms = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, created.batch.id));
    expect(updateComms).toHaveLength(0);
  });

  it('retries batch final confirmation with exact customized draft and fresh document link', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.batchCentreId,
        shifts: [
          {
            shiftDate: '2029-12-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
        ],
      },
      FIXTURE.batchOpsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    for (const child of created.created) {
      await assignContactedStaffForIntegration(
        shiftsService,
        child.id,
        FIXTURE.batchStaffA,
        FIXTURE.batchOpsUser,
      );
    }

    const customBody = [
      'RETRY_CUSTOM_BODY exact approved wording',
      'RETRY_CUSTOM_SECTION still here',
      buildCentreEmailSecureDocMarker(FIXTURE.batchStaffA),
    ].join('\n');

    const completed = await completionService.complete(created.batch.id, FIXTURE.batchOpsUser, {
      subject: 'RETRY_CUSTOM_SUBJECT exact approved subject',
      body: customBody,
    });

    const firstOutcome = await finalProcessor.evaluate(db, {
      scheduledCommunicationId: completed.scheduledCommunicationId!,
      recipientEntityId: FIXTURE.batchCentreId,
    });
    expect(firstOutcome.kind).toBe('valid');
    if (firstOutcome.kind !== 'valid') return;

    expect(firstOutcome.subject).toBe('RETRY_CUSTOM_SUBJECT exact approved subject');
    expect(firstOutcome.text).toContain('RETRY_CUSTOM_BODY exact approved wording');
    expect(firstOutcome.text).not.toContain('Your shift request is now fully confirmed');

    const firstUrl =
      firstOutcome.text!.match(/https:\/\/platform\.intra\.ca\/documents\/[^\s]+/g)?.[0] ?? '';
    expect(firstUrl).toBeTruthy();

    await revokeStaffDocumentShare(db, FIXTURE.batchStaffA);

    const retryOutcome = await finalProcessor.evaluate(db, {
      scheduledCommunicationId: completed.scheduledCommunicationId!,
      recipientEntityId: FIXTURE.batchCentreId,
    });
    expect(retryOutcome.kind).toBe('valid');
    if (retryOutcome.kind !== 'valid') return;

    expect(retryOutcome.subject).toBe('RETRY_CUSTOM_SUBJECT exact approved subject');
    expect(retryOutcome.text).toContain('RETRY_CUSTOM_BODY exact approved wording');
    expect(retryOutcome.text).toContain('RETRY_CUSTOM_SECTION still here');

    const secondUrl =
      retryOutcome.text!.match(/https:\/\/platform\.intra\.ca\/documents\/[^\s]+/g)?.[0] ?? '';
    expect(secondUrl).toBeTruthy();
    await assertDocumentShareUrlValid(db, config, FIXTURE.batchStaffA, secondUrl);
    expect(customBody).not.toContain(firstUrl);
    expect(customBody).not.toContain(secondUrl);
  });
});

describe.runIf(!POSTGRES_READY)('Centre email editing integration', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
