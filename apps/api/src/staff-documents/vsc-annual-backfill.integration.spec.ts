import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomatedCommunicationsReconcilerService } from '../automated-communications/automated-communications-reconciler.service';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { CommunicationsQueueService } from '../automated-communications/communications-queue.service';
import { ScheduledCommunicationsService } from '../automated-communications/scheduled-communications.service';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import * as schema from '../db/schema';
import {
  scheduledCommunications,
  staff,
  staffAccounts,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';
import { buildDocumentExpiryIdempotencyKey, DOCUMENT_EXPIRY_COMMUNICATION_TYPE } from './document-expiry-reminder.types';
import { torontoDocumentReminderInstant } from './document-expiry-toronto.util';
import { addCalendarDays, deriveVscExpiryDate, startOfUtcDay } from './staff-document-dates.util';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const TEST_PREFIX = `intra-test-vsc-backfill-${Date.now()}`;

const VSC_BACKFILL_SQL = readFileSync(
  join(__dirname, '../../drizzle/0013_vsc_annual_expiry_backfill.sql'),
  'utf8',
);

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
const INTEGRATION_READY = POSTGRES_READY && REDIS_READY;

function buildConfig(): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'REDIS_URL') return REDIS_URL;
      if (key === 'COMMUNICATIONS_QUEUE_PREFIX') return TEST_PREFIX;
      if (key === 'COMMUNICATIONS_WORKER_CONCURRENCY') return 1;
      if (key === 'COMMUNICATIONS_RETRY_ATTEMPTS') return 5;
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
    .values({ legalName: `VSC Backfill ${email}`, email, phone: '4165550100' })
    .returning({ id: staff.id });
  const staffId = staffRows[0]!.id;

  const accountRows = await db
    .insert(staffAccounts)
    .values({ staffId, email, status: 'active', onboardingStep: 3 })
    .returning({ id: staffAccounts.id });

  return { staffId, accountId: accountRows[0]!.id };
}

async function runVscBackfill(pool: Pool): Promise<number> {
  const result = await pool.query(VSC_BACKFILL_SQL);
  return result.rowCount ?? 0;
}

function dateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractCalendarYears(dateOnly: string, years: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return `${year - years}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe.runIf(INTEGRATION_READY)('VSC annual expiry backfill + reminder reconciliation', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let queue: CommunicationsQueueService;
  let automated: AutomatedCommunicationsService;
  let documentReminders: DocumentExpiryReminderService;
  let reconciler: AutomatedCommunicationsReconcilerService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    const config = buildConfig();
    scheduled = new ScheduledCommunicationsService(db);
    queue = new CommunicationsQueueService(config);
    automated = new AutomatedCommunicationsService(scheduled, queue);
    documentReminders = new DocumentExpiryReminderService(db, automated);
    reconciler = new AutomatedCommunicationsReconcilerService(scheduled, queue, undefined, documentReminders);
  });

  afterAll(async () => {
    await queue?.onModuleDestroy().catch(() => undefined);
    await pool?.end().catch(() => undefined);
  });

  it('A. backfills current approved VSC from legacy +3y expiry and reschedules reminders', async () => {
    const processedDate = '2026-08-01';
    const legacyExpiry = '2029-08-01';
    const expectedExpiry = '2027-08-01';
    expect(deriveVscExpiryDate(processedDate)).toBe(expectedExpiry);

    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-approved-${TEST_PREFIX}@example.test`,
    );

    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: legacyExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: submissionId })
      .where(eq(staffDocumentSets.id, setId));

    for (const offsetDays of [30, 14, 7, 3, 1] as const) {
      await scheduled.schedule({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays }),
        communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[offsetDays],
        entityType: 'staff_document',
        entityId: submissionId,
        recipientType: 'staff',
        recipientEntityId: staffId,
        scheduledFor: torontoDocumentReminderInstant(legacyExpiry, offsetDays),
      });
    }

    const updated = await runVscBackfill(pool);
    expect(updated).toBeGreaterThanOrEqual(1);

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe(expectedExpiry);

    const plans = [
      { offset: 30 as const, at: torontoDocumentReminderInstant(expectedExpiry, 30) },
      { offset: 14 as const, at: torontoDocumentReminderInstant(expectedExpiry, 14) },
      { offset: 7 as const, at: torontoDocumentReminderInstant(expectedExpiry, 7) },
      { offset: 3 as const, at: torontoDocumentReminderInstant(expectedExpiry, 3) },
      { offset: 1 as const, at: torontoDocumentReminderInstant(expectedExpiry, 1) },
    ];

    for (const plan of plans) {
      const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: plan.offset });
      await scheduled.ensureScheduled({
        idempotencyKey: key,
        communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[plan.offset],
        entityType: 'staff_document',
        entityId: submissionId,
        recipientType: 'staff',
        recipientEntityId: staffId,
        scheduledFor: plan.at,
      });
    }

    await documentReminders.reconcileEligibleDocuments();

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));

    for (const plan of plans) {
      const row = rows.find((r) => r.idempotencyKey.endsWith(`:${plan.offset}d`));
      expect(row?.status).toBe('scheduled');
      expect(row?.scheduledFor.toISOString()).toBe(plan.at.toISOString());
    }

    expect(rows.some((r) => r.scheduledFor.toISOString().includes('2029'))).toBe(false);

    for (const plan of plans) {
      const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: plan.offset });
      const sync = await queue.syncJobSchedule({
        scheduledCommunicationId: rows.find((r) => r.idempotencyKey === key)!.id,
        idempotencyKey: key,
        scheduledFor: plan.at,
      });
      expect(sync === 'created' || sync === 'rescheduled' || sync === 'unchanged').toBe(true);

      const fireTime = await queue.getJobFireTime(key);
      expect(fireTime).not.toBeNull();
      expect(Math.abs(fireTime! - plan.at.getTime())).toBeLessThanOrEqual(2000);
    }
  }, 30_000);

  it('B. backfills pending current VSC without active reminders', async () => {
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-pending-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'pending_review',
        processedDate: '2026-08-01',
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    await scheduled.schedule({
      idempotencyKey: buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 30 }),
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: torontoDocumentReminderInstant('2029-08-01', 30),
    });

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe('2027-08-01');

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.every((r) => r.status === 'cancelled')).toBe(true);
  }, 20_000);

  it('C. does not modify superseded VSC submissions', async () => {
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-superseded-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const oldRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate: '2020-08-01',
        expiryDate: '2023-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
        supersededAt: new Date(),
      })
      .returning({ id: staffDocumentSubmissions.id });
    const oldId = oldRows[0]!.id;

    const currentRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate: '2026-08-01',
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const currentId = currentRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: currentId }).where(eq(staffDocumentSets.id, setId));

    await runVscBackfill(pool);

    const oldSubmission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, oldId));
    expect(oldSubmission[0]?.expiryDate).toBe('2023-08-01');
  }, 20_000);

  it('H. handles leap-day processed dates in backfill SQL', async () => {
    const processedDate = '2028-02-29';
    expect(deriveVscExpiryDate(processedDate)).toBe('2029-02-28');

    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-leap-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: '2031-02-28',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    await runVscBackfill(pool);

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe('2029-02-28');
  }, 20_000);

  it('D. backfills already-expired current VSC and cancels stale +3y reminders', async () => {
    const today = startOfUtcDay(new Date());
    const expectedExpiry = dateOnlyString(addCalendarDays(today, -400));
    const processedDate = subtractCalendarYears(expectedExpiry, 1);
    const legacyExpiry = subtractCalendarYears(expectedExpiry, -2);

    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-expired-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: legacyExpiry,
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    for (const offsetDays of [30, 14, 7, 3, 1] as const) {
      await scheduled.schedule({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays }),
        communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[offsetDays],
        entityType: 'staff_document',
        entityId: submissionId,
        recipientType: 'staff',
        recipientEntityId: staffId,
        scheduledFor: torontoDocumentReminderInstant(legacyExpiry, offsetDays),
      });
    }

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe(expectedExpiry);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.every((row) => row.status === 'cancelled')).toBe(true);
    expect(rows.some((row) => row.scheduledFor.toISOString().includes('2029'))).toBe(false);
  }, 60_000);

  it('E. keeps only future reminder intervals when annual expiry is 10 days away', async () => {
    const today = startOfUtcDay(new Date());
    const expectedExpiry = dateOnlyString(addCalendarDays(today, 10));
    const processedDate = subtractCalendarYears(expectedExpiry, 1);

    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-10d-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: subtractCalendarYears(expectedExpiry, -2),
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    for (const offsetDays of [30, 14, 7, 3, 1] as const) {
      await scheduled.schedule({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays }),
        communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[offsetDays],
        entityType: 'staff_document',
        entityId: submissionId,
        recipientType: 'staff',
        recipientEntityId: staffId,
        scheduledFor: torontoDocumentReminderInstant(subtractCalendarYears(expectedExpiry, -2), offsetDays),
      });
    }

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const expectedOffsets = planFutureDocumentExpiryReminders(expectedExpiry).map((plan) => plan.offsetDays);
    expect(expectedOffsets).toEqual([7, 3, 1]);

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    const active = rows.filter((row) => row.status === 'scheduled');
    expect(active.map((row) => Number.parseInt(row.idempotencyKey.split(':expiry:')[1] ?? '0', 10)).sort((a, b) => b - a))
      .toEqual([7, 3, 1]);
    expect(rows.filter((row) => row.status === 'cancelled').length).toBeGreaterThan(0);
  }, 60_000);

  it('F. backfills issue-flagged current VSC without active reminders', async () => {
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-flagged-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'issue_flagged',
        processedDate: '2026-08-01',
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    await scheduled.schedule({
      idempotencyKey: buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 30 }),
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: torontoDocumentReminderInstant('2029-08-01', 30),
    });

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe('2027-08-01');

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.every((row) => row.status === 'cancelled')).toBe(true);
  }, 20_000);

  it('G. does not modify current First Aid submissions', async () => {
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `fa-unchanged-${TEST_PREFIX}@example.test`,
    );
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
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    await runVscBackfill(pool);

    const submission = await db
      .select()
      .from(staffDocumentSubmissions)
      .where(eq(staffDocumentSubmissions.id, submissionId));
    expect(submission[0]?.expiryDate).toBe('2029-08-01');
  }, 20_000);

  it('I. restores cancelled future reminders after backfill when still eligible', async () => {
    const processedDate = '2026-08-01';
    const expectedExpiry = '2027-08-01';
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-restore-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 30 });
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: torontoDocumentReminderInstant('2029-08-01', 30),
    });

    await scheduled.markCancelled(row.id, 'test_cancel', 'Cancelled for restore test');

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const restored = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, row.id));
    expect(restored[0]?.status).toBe('scheduled');
    expect(restored[0]?.scheduledFor.toISOString()).toBe(
      torontoDocumentReminderInstant(expectedExpiry, 30).toISOString(),
    );
  }, 20_000);

  it('J. preserves already-sent reminder history without duplicating', async () => {
    const processedDate = '2026-08-01';
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-sent-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 30 });
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: torontoDocumentReminderInstant('2029-08-01', 30),
    });
    await scheduled.markSent(row.id);

    await runVscBackfill(pool);
    await documentReminders.reconcileEligibleDocuments();

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.entityId, submissionId));
    expect(rows.filter((row) => row.idempotencyKey === key)).toHaveLength(1);
    expect(rows.find((row) => row.idempotencyKey === key)?.status).toBe('sent');
  }, 20_000);

  it('K. resynchronizes persistent BullMQ delayed jobs after expiry correction', async () => {
    const processedDate = '2026-08-01';
    const expectedExpiry = '2027-08-01';
    const { staffId, accountId } = await insertActiveStaffWithAccount(
      db,
      `vsc-bullmq-${TEST_PREFIX}@example.test`,
    );
    const setRows = await db
      .insert(staffDocumentSets)
      .values({ staffId, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const setId = setRows[0]!.id;

    const submissionRows = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: setId,
        reviewStatus: 'approved',
        processedDate,
        expiryDate: '2029-08-01',
        submittedAt: new Date(),
        submittedByActorType: 'carer',
        submittedByStaffAccountId: accountId,
      })
      .returning({ id: staffDocumentSubmissions.id });
    const submissionId = submissionRows[0]!.id;

    await db.update(staffDocumentSets).set({ currentSubmissionId: submissionId }).where(eq(staffDocumentSets.id, setId));

    const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 14 });
    const oldTime = torontoDocumentReminderInstant('2029-08-01', 14);
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'document_expiry_14d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: oldTime,
    });

    await queue.enqueue({
      scheduledCommunicationId: row.id,
      idempotencyKey: key,
      scheduledFor: oldTime,
    });

    await runVscBackfill(pool);
    const newTime = torontoDocumentReminderInstant(expectedExpiry, 14);
    await scheduled.ensureScheduled({
      idempotencyKey: key,
      communicationType: 'document_expiry_14d',
      entityType: 'staff_document',
      entityId: submissionId,
      recipientType: 'staff',
      recipientEntityId: staffId,
      scheduledFor: newTime,
    });

    const sync = await queue.syncJobSchedule({
      scheduledCommunicationId: row.id,
      idempotencyKey: key,
      scheduledFor: newTime,
    });
    expect(sync).toBe('rescheduled');

    const fireTime = await queue.getJobFireTime(key);
    expect(fireTime).not.toBeNull();
    expect(Math.abs(fireTime! - newTime.getTime())).toBeLessThanOrEqual(2000);
    expect(Math.abs(fireTime! - oldTime.getTime())).toBeGreaterThan(86400000);
  }, 20_000);
});

describe.runIf(POSTGRES_READY)('ensureScheduled reschedules existing document reminders', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);
    scheduled = new ScheduledCommunicationsService(db);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('updates scheduled_for on an existing scheduled row with the same idempotency key', async () => {
    const key = `test:reschedule:${Date.now()}`;
    const oldTime = torontoDocumentReminderInstant('2029-08-01', 30);
    const newTime = torontoDocumentReminderInstant('2027-08-01', 30);

    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: '11111111-1111-4111-8111-111111111111',
      recipientType: 'staff',
      scheduledFor: oldTime,
    });

    const updated = await scheduled.ensureScheduled({
      idempotencyKey: key,
      communicationType: 'document_expiry_30d',
      entityType: 'staff_document',
      entityId: '11111111-1111-4111-8111-111111111111',
      recipientType: 'staff',
      scheduledFor: newTime,
    });

    expect(updated.id).toBe(row.id);
    expect(updated.scheduledFor.toISOString()).toBe(newTime.toISOString());
  });
});
