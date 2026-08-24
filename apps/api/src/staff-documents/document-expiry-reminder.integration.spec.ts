import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { AutomatedCommunicationsProcessor } from '../automated-communications/automated-communications.processor';
import { CommunicationProcessorRegistry } from '../automated-communications/communication-processor.registry';
import { CommunicationsQueueService } from '../automated-communications/communications-queue.service';
import { ScheduledCommunicationsService } from '../automated-communications/scheduled-communications.service';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import * as schema from '../db/schema';
import {
  scheduledCommunications,
  staff,
  staffAccounts,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { EmailService, RecordingEmailTransport } from '../email/email.service';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';
import { registerDocumentExpiryProcessors } from './document-expiry-reminder.processor';
import { buildDocumentExpiryIdempotencyKeyMonths } from './document-expiry-reminder.types';
import {
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';
import { deriveVscExpiryDate, startOfUtcDay, addCalendarDays } from './staff-document-dates.util';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const TEST_PREFIX = `intra-test-doc-expiry-${Date.now()}`;
const TEST_EMAIL_PG = `doc-reminder-${TEST_PREFIX}@example.test`;
const TEST_EMAIL_WORKER = `doc-worker-${TEST_PREFIX}@example.test`;

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

async function probeRedis(): Promise<boolean> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2500 });
  try {
    await client.ping();
    await client.quit();
    return true;
  } catch {
    await client.quit().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();
const REDIS_READY = await probeRedis();

function buildConfig(): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'REDIS_URL') return REDIS_URL;
      if (key === 'COMMUNICATIONS_QUEUE_PREFIX') return TEST_PREFIX;
      if (key === 'COMMUNICATIONS_WORKER_CONCURRENCY') return 1;
      if (key === 'COMMUNICATIONS_RETRY_ATTEMPTS') return 5;
      if (key === 'APP_PUBLIC_URL') return 'https://app.example.test';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
    getOrThrow: (key: string) => {
      const map: Record<string, string | number> = {
        REDIS_URL: REDIS_URL,
        COMMUNICATIONS_QUEUE_PREFIX: TEST_PREFIX,
        COMMUNICATIONS_WORKER_CONCURRENCY: 1,
        COMMUNICATIONS_RETRY_ATTEMPTS: 5,
      };
      const value = map[key];
      if (value === undefined) throw new Error(`missing ${key}`);
      return value;
    },
  } as ConfigService;
}

async function insertActiveStaffWithAccount(
  db: NodePgDatabase<typeof schema>,
  email: string,
): Promise<{ staffId: string; accountId: string }> {
  const staffRows = await db
    .insert(staff)
    .values({ legalName: `Doc Test ${email}`, email, phone: '4165550199' })
    .returning({ id: staff.id });
  const staffId = staffRows[0]!.id;

  const accountRows = await db
    .insert(staffAccounts)
    .values({ staffId, email, status: 'active', onboardingStep: 3 })
    .returning({ id: staffAccounts.id });

  return { staffId, accountId: accountRows[0]!.id };
}

describe.runIf(POSTGRES_READY)('Document expiry reminder PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let documentReminders: DocumentExpiryReminderService;
  let staffId: string;
  let accountId: string;
  let setId: string;
  let submissionId: string;
  const expiryDate = '2099-06-15';

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    const config = buildConfig();
    const scheduled = new ScheduledCommunicationsService(db);
    const queue = new CommunicationsQueueService(config);
    const automated = new AutomatedCommunicationsService(scheduled, queue);
    documentReminders = new DocumentExpiryReminderService(db, automated);

    const staffRows = await db
      .insert(staff)
      .values({ legalName: 'Doc Reminder Carer', email: TEST_EMAIL_PG, phone: '4165550101' })
      .returning({ id: staff.id });
    staffId = staffRows[0]!.id;

    const accountRows = await db
      .insert(staffAccounts)
      .values({
        staffId,
        email: TEST_EMAIL_PG,
        status: 'active',
        onboardingStep: 3,
      })
      .returning({ id: staffAccounts.id });
    accountId = accountRows[0]!.id;

    const setRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId,
        documentType: 'vulnerable_sector_check',
        remindersEnabled: true,
      })
      .returning({ id: staffDocumentSets.id });
    setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate: '2096-06-15',
        expiryDate,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    submissionId = submissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: submissionId })
      .where(eq(staffDocumentSets.id, setId));

    await db.insert(staffDocumentFiles).values({
      submissionId,
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `staff/${staffId}/test/vsc.pdf`,
      checksumSha256: 'abc',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates future schedule rows idempotently on approval scheduling', async () => {
    let scheduledIds: string[] = [];
    await db.transaction(async (tx) => {
      scheduledIds = await documentReminders.scheduleForApprovedSubmission(
        {
          staffId,
          documentSetId: setId,
          documentType: 'vulnerable_sector_check',
          submissionId,
          expiryDate,
        },
        tx,
        new Date(torontoDocumentReminderInstant(expiryDate, 40).getTime() - 60_000),
      );
    });

    expect(scheduledIds.length).toBe(5);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.length).toBe(5);

    await db.transaction(async (tx) => {
      const again = await documentReminders.scheduleForApprovedSubmission(
        {
          staffId,
          documentSetId: setId,
          documentType: 'vulnerable_sector_check',
          submissionId,
          expiryDate,
        },
        tx,
        new Date(torontoDocumentReminderInstant(expiryDate, 40).getTime() - 60_000),
      );
      expect(again.length).toBe(5);
    });

    const rowsAfter = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rowsAfter.length).toBe(5);
  });

  it('cancels pending reminders for a superseded submission', async () => {
    const cancelled = await documentReminders.cancelPendingForSubmission(submissionId);
    expect(cancelled).toBeGreaterThan(0);

    const pending = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(pending.every((row) => row.status === 'cancelled')).toBe(true);
  });

  it('reconciler backfills remaining future reminders for eligible approved documents', async () => {
    await db
      .update(scheduledCommunications)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(scheduledCommunications.entityId, submissionId));

    const result = await documentReminders.reconcileEligibleDocuments();
    expect(result.ensured).toBeGreaterThan(0);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.some((row) => row.status === 'scheduled')).toBe(true);
  }, 60_000);

  it('schedules First Aid 2026-09-04 with no future monthly reminders when today is 2026-08-18', async () => {
    const cprExpiry = '2026-09-04';
    const cprNow = new Date('2026-08-18T13:00:00.000Z');
    const cprSetRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId,
        documentType: 'first_aid_cpr',
        remindersEnabled: false,
      })
      .returning({ id: staffDocumentSets.id });
    const cprSetId = cprSetRows[0]!.id;

    const cprSubmissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: cprSetId,
        reviewStatus: 'approved',
        expiryDate: cprExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const cprSubmissionId = cprSubmissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: cprSubmissionId })
      .where(eq(staffDocumentSets.id, cprSetId));

    let scheduledIds: string[] = [];
    await db.transaction(async (tx) => {
      scheduledIds = await documentReminders.scheduleForApprovedSubmission(
        {
          staffId,
          documentSetId: cprSetId,
          documentType: 'first_aid_cpr',
          submissionId: cprSubmissionId,
          expiryDate: cprExpiry,
        },
        tx,
        cprNow,
      );
    });

    expect(scheduledIds.length).toBe(0);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, cprSubmissionId));
    expect(rows.filter((row) => row.status === 'scheduled')).toEqual([]);
    expect(rows.some((row) => row.communicationType === 'document_expiry_30d')).toBe(false);
    expect(rows.some((row) => row.communicationType === 'document_expiry_14d')).toBe(false);
    expect(rows.some((row) => row.communicationType === 'document_expiry_7d')).toBe(false);
    expect(rows.some((row) => row.communicationType === 'document_expiry_3d')).toBe(false);
    expect(rows.some((row) => row.communicationType === 'document_expiry_1d')).toBe(false);
    expect(rows.some((row) => row.communicationType === 'document_expiry_1mo')).toBe(false);

    await documentReminders.cancelPendingForSubmission(cprSubmissionId);

    await documentReminders.reconcileEligibleDocuments();

    const reactivated = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, cprSubmissionId));
    expect(reactivated.filter((row) => row.status === 'scheduled').length).toBe(0);
  }, 20_000);

  it('cancels legacy First Aid day reminders during reconciliation without touching VSC', async () => {
    const transitionStaff = await insertActiveStaffWithAccount(
      db,
      `doc-fa-transition-${TEST_PREFIX}@example.test`,
    );
    const cprExpiry = '2027-06-15';
    const cprSetRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId: transitionStaff.staffId,
        documentType: 'first_aid_cpr',
        remindersEnabled: true,
      })
      .returning({ id: staffDocumentSets.id });
    const cprSetId = cprSetRows[0]!.id;

    const cprSubmissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: cprSetId,
        reviewStatus: 'approved',
        expiryDate: cprExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: transitionStaff.accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const cprSubmissionId = cprSubmissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: cprSubmissionId })
      .where(eq(staffDocumentSets.id, cprSetId));

    await db.insert(scheduledCommunications).values([
      {
        idempotencyKey: `staff-document:${cprSubmissionId}:expiry:30d`,
        communicationType: 'document_expiry_30d',
        entityType: 'staff_document',
        entityId: cprSubmissionId,
        recipientType: 'staff',
        recipientEntityId: transitionStaff.staffId,
        scheduledFor: torontoDocumentReminderInstant(cprExpiry, 30),
        status: 'scheduled',
      },
      {
        idempotencyKey: `staff-document:${cprSubmissionId}:expiry:14d`,
        communicationType: 'document_expiry_14d',
        entityType: 'staff_document',
        entityId: cprSubmissionId,
        recipientType: 'staff',
        recipientEntityId: transitionStaff.staffId,
        scheduledFor: torontoDocumentReminderInstant(cprExpiry, 14),
        status: 'scheduled',
      },
    ]);

    await documentReminders.reconcileEligibleDocuments();

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, cprSubmissionId));

    expect(rows.filter((row) => row.status === 'scheduled').map((row) => row.communicationType)).toEqual([
      'document_expiry_3mo',
      'document_expiry_2mo',
      'document_expiry_1mo',
    ]);
    expect(rows.filter((row) => row.status === 'cancelled').map((row) => row.communicationType)).toEqual([
      'document_expiry_30d',
      'document_expiry_14d',
    ]);
  }, 20_000);

  it('schedules VSC reminders from calculated one-year expiry (processed 2026-09-04)', async () => {
    const processedDate = '2026-09-04';
    const vscExpiry = deriveVscExpiryDate(processedDate);
    expect(vscExpiry).toBe('2027-09-04');

    const vscStaff = await insertActiveStaffWithAccount(
      db,
      `doc-vsc-schedule-${TEST_PREFIX}@example.test`,
    );

    const vscSetRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId: vscStaff.staffId,
        documentType: 'vulnerable_sector_check',
        remindersEnabled: false,
      })
      .returning({ id: staffDocumentSets.id });
    const vscSetId = vscSetRows[0]!.id;

    const vscSubmissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: vscSetId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: vscExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: vscStaff.accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const vscSubmissionId = vscSubmissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: vscSubmissionId })
      .where(eq(staffDocumentSets.id, vscSetId));

    const scheduleNow = new Date('2026-08-18T13:00:00.000Z');
    let scheduledIds: string[] = [];
    await db.transaction(async (tx) => {
      scheduledIds = await documentReminders.scheduleForApprovedSubmission(
        {
          staffId: vscStaff.staffId,
          documentSetId: vscSetId,
          documentType: 'vulnerable_sector_check',
          submissionId: vscSubmissionId,
          expiryDate: vscExpiry,
        },
        tx,
        scheduleNow,
      );
    });

    expect(scheduledIds.length).toBe(5);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, vscSubmissionId));
    expect(
      rows
        .filter((row) => row.status === 'scheduled')
        .map((row) => row.communicationType)
        .sort(),
    ).toEqual([
      'document_expiry_14d',
      'document_expiry_1d',
      'document_expiry_30d',
      'document_expiry_3d',
      'document_expiry_7d',
    ]);
  }, 20_000);

  it('annual VSC replacement cancels old reminders and schedules after approval', async () => {
    const oldProcessed = '2025-09-04';
    const oldExpiry = deriveVscExpiryDate(oldProcessed);
    const newProcessed = '2026-09-04';
    const newExpiry = deriveVscExpiryDate(newProcessed);

    const replaceStaff = await insertActiveStaffWithAccount(
      db,
      `doc-vsc-replace-${TEST_PREFIX}@example.test`,
    );

    const setRows = await db
      .insert(staffDocumentSets)
      .values({
        staffId: replaceStaff.staffId,
        documentType: 'vulnerable_sector_check',
        remindersEnabled: true,
      })
      .returning({ id: staffDocumentSets.id });
    const replaceSetId = setRows[0]!.id;

    const oldSubmissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: replaceSetId,
        reviewStatus: 'approved',
        processedDate: oldProcessed,
        expiryDate: oldExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: replaceStaff.accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const oldSubmissionId = oldSubmissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: oldSubmissionId })
      .where(eq(staffDocumentSets.id, replaceSetId));

    await db.transaction(async (tx) => {
      await documentReminders.scheduleForApprovedSubmission(
        {
          staffId: replaceStaff.staffId,
          documentSetId: replaceSetId,
          documentType: 'vulnerable_sector_check',
          submissionId: oldSubmissionId,
          expiryDate: oldExpiry,
        },
        tx,
        new Date('2026-01-01T12:00:00.000Z'),
      );
    });

    const newSubmissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: replaceSetId,
        reviewStatus: 'pending_review',
        processedDate: newProcessed,
        expiryDate: newExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: replaceStaff.accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const newSubmissionId = newSubmissionRows[0]!.id;

    await db
      .update(staffDocumentSubmissions)
      .set({ supersededAt: new Date() })
      .where(eq(staffDocumentSubmissions.id, oldSubmissionId));

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: newSubmissionId })
      .where(eq(staffDocumentSets.id, replaceSetId));

    await documentReminders.cancelPendingForSubmission(oldSubmissionId);

    const oldRows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, oldSubmissionId));
    expect(oldRows.every((row) => row.status === 'cancelled')).toBe(true);

    const pendingNew = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, newSubmissionId));
    expect(pendingNew).toHaveLength(0);

    await db
      .update(staffDocumentSubmissions)
      .set({ reviewStatus: 'approved', reviewedAt: new Date() })
      .where(eq(staffDocumentSubmissions.id, newSubmissionId));

    let approvedIds: string[] = [];
    await db.transaction(async (tx) => {
      approvedIds = await documentReminders.scheduleForApprovedSubmission(
        {
          staffId: replaceStaff.staffId,
          documentSetId: replaceSetId,
          documentType: 'vulnerable_sector_check',
          submissionId: newSubmissionId,
          expiryDate: newExpiry,
        },
        tx,
        new Date('2026-08-18T13:00:00.000Z'),
      );
    });

    expect(approvedIds.length).toBe(5);

    const newRows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, newSubmissionId));
    expect(newRows.filter((row) => row.status === 'scheduled').length).toBe(5);
  }, 20_000);
});

describe.runIf(POSTGRES_READY && REDIS_READY)('Document expiry worker integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let processor: AutomatedCommunicationsProcessor;
  let queue: CommunicationsQueueService;
  let automated: AutomatedCommunicationsService;
  let scheduled: ScheduledCommunicationsService;
  let recording: RecordingEmailTransport;
  let staffId: string;
  let submissionId: string;
  let workerStarted = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    const config = buildConfig();
    scheduled = new ScheduledCommunicationsService(db);
    queue = new CommunicationsQueueService(config);
    automated = new AutomatedCommunicationsService(scheduled, queue);

    const registry = new CommunicationProcessorRegistry();
    registerDocumentExpiryProcessors(registry, config);

    const email = new EmailService({
      get: (key: string) => {
        if (key === 'EMAIL_FROM') return 'Test <test@example.com>';
        if (key === 'RESEND_API_KEY') return 're_test';
        return undefined;
      },
    } as ConfigService);
    recording = new RecordingEmailTransport();
    email.useTransport(recording);

    processor = new AutomatedCommunicationsProcessor(config, db, scheduled, email, registry, queue);
    processor.startWorker();
    workerStarted = true;

    const staffRows = await db
      .insert(staff)
      .values({ legalName: 'Doc Worker Carer', email: TEST_EMAIL_WORKER, phone: '4165550102' })
      .returning({ id: staff.id });
    staffId = staffRows[0]!.id;

    const accountRows = await db
      .insert(staffAccounts)
      .values({ staffId, email: TEST_EMAIL_WORKER, status: 'active', onboardingStep: 3 })
      .returning({ id: staffAccounts.id });
    const accountId = accountRows[0]!.id;

    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'first_aid_cpr', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        expiryDate: '2099-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));
    await db.insert(staffDocumentFiles).values({
      submissionId,
      originalFilename: 'fa.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `staff/${staffId}/test/fa.pdf`,
      checksumSha256: 'def',
    });
  });

  afterAll(async () => {
    if (workerStarted) await processor.stopWorker();
    await queue?.onModuleDestroy().catch(() => undefined);
    await pool.end();
  });

  it('processes a due document expiry reminder via worker', async () => {
    const today = startOfUtcDay(new Date());
    const expiryDate = addCalendarDays(today, 20).toISOString().slice(0, 10);
    await db
      .update(staffDocumentSubmissions)
      .set({ expiryDate })
      .where(eq(staffDocumentSubmissions.id, submissionId));

    const scheduledFor = torontoDocumentReminderInstantMonths(expiryDate, 1);
    expect(scheduledFor.getTime()).toBeLessThanOrEqual(Date.now());

    const row = await scheduled.schedule({
      idempotencyKey: buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths: 1 }),
      communicationType: 'document_expiry_1mo',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor,
    });

    await automated.enqueueScheduledCommunication(row.id);

    await vi.waitFor(
      async () => {
        const current = await scheduled.findById(row.id);
        expect(current?.status).toBe('sent');
      },
      { timeout: 15_000, interval: 250 },
    );

    expect(recording.sent.length).toBeGreaterThan(0);
    expect(recording.sent.at(-1)?.subject).toContain('First Aid');
  }, 20_000);
});
