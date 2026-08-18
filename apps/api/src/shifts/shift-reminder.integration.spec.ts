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
import { centres, scheduledCommunications, shifts, staff } from '../db/schema';
import { EmailService, RecordingEmailTransport } from '../email/email.service';
import { ShiftReminderService } from './shift-reminder.service';
import { registerShiftReminderProcessors } from './shift-reminder.processor';
import { buildShiftReminderIdempotencyKey } from './shift-reminder.types';
import { torontoShiftStartInstant } from './shift-toronto.util';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const TEST_PREFIX = `intra-test-reminder-${Date.now()}`;

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
      if (key === 'APP_HOST') return 'app.example.test';
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

describe.runIf(POSTGRES_READY)('Shift reminder PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let automated: AutomatedCommunicationsService;
  let shiftReminders: ShiftReminderService;
  let centreId: string;
  let staffId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    const config = buildConfig();
    scheduled = new ScheduledCommunicationsService(db);
    const queue = new CommunicationsQueueService(config);
    automated = new AutomatedCommunicationsService(scheduled, queue);
    shiftReminders = new ShiftReminderService(db, automated);

    const centreRows = await db
      .insert(centres)
      .values({
        name: 'Reminder Test Centre',
        address: '1 Test St',
        city: 'Toronto',
        notes: 'Test centre notes',
      })
      .returning({ id: centres.id });
    centreId = centreRows[0]!.id;

    const staffRows = await db
      .insert(staff)
      .values({
        legalName: 'Reminder Carer',
        email: 'reminder-carer@example.test',
        phone: '4165550100',
      })
      .returning({ id: staff.id });
    staffId = staffRows[0]!.id;
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('creates versioned schedule rows idempotently', async () => {
    const shiftDate = '2027-06-15';
    const startTime = '09:00:00';
    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId,
        shiftDate,
        startTime,
        endTime: '17:00:00',
        status: 'filled',
        assignedStaffId: staffId,
      })
      .returning({ id: shifts.id });
    const shiftId = shiftRows[0]!.id;

    const now = new Date(torontoShiftStartInstant(shiftDate, startTime).getTime() - 5 * 86400000);
    const ids = await shiftReminders.scheduleForFilledShift(
      { shiftId, assignedStaffId: staffId, shiftDate, startTime },
      db,
      now,
    );
    expect(ids.length).toBe(3);

    const again = await shiftReminders.scheduleForFilledShift(
      { shiftId, assignedStaffId: staffId, shiftDate, startTime },
      db,
      now,
    );
    expect(again).toEqual(ids);

    const key = buildShiftReminderIdempotencyKey({
      shiftId,
      assignedStaffId: staffId,
      shiftDate,
      startTime,
      interval: '3d',
    });
    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, key));
    expect(rows[0]?.status).toBe('scheduled');
  });

  it('cancels pending reminders on reschedule without duplicating sent history', async () => {
    const shiftDate = '2027-07-01';
    const startTime = '10:00:00';
    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId,
        shiftDate,
        startTime,
        endTime: '18:00:00',
        status: 'filled',
        assignedStaffId: staffId,
      })
      .returning({ id: shifts.id });
    const shiftId = shiftRows[0]!.id;
    const now = new Date(torontoShiftStartInstant(shiftDate, startTime).getTime() - 5 * 86400000);

    await shiftReminders.scheduleForFilledShift(
      { shiftId, assignedStaffId: staffId, shiftDate, startTime },
      db,
      now,
    );

    const newDate = '2027-07-05';
    await db
      .update(shifts)
      .set({ shiftDate: newDate })
      .where(eq(shifts.id, shiftId));

    await shiftReminders.rescheduleFilledShift(
      { shiftId, assignedStaffId: staffId, shiftDate: newDate, startTime },
      db,
      now,
    );

    const oldKey = buildShiftReminderIdempotencyKey({
      shiftId,
      assignedStaffId: staffId,
      shiftDate,
      startTime,
      interval: '3d',
    });
    const newKey = buildShiftReminderIdempotencyKey({
      shiftId,
      assignedStaffId: staffId,
      shiftDate: newDate,
      startTime,
      interval: '3d',
    });

    const oldRow = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, oldKey));
    const newRow = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, newKey));

    expect(oldRow[0]?.status).toBe('cancelled');
    expect(newRow[0]?.status).toBe('scheduled');
  });
});

describe.runIf(POSTGRES_READY && REDIS_READY)('Shift reminder worker integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let queue: CommunicationsQueueService;
  let automated: AutomatedCommunicationsService;
  let processor: AutomatedCommunicationsProcessor;
  let email: EmailService;
  let recording: RecordingEmailTransport;
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
    registerShiftReminderProcessors(registry, config);

    email = new EmailService({
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
  });

  afterAll(async () => {
    if (workerStarted) await processor.stopWorker();
    await queue?.onModuleDestroy().catch(() => undefined);
    await pool?.end().catch(() => undefined);
  });

  it('processes a due shift reminder via worker', async () => {
    const centreRows = await db
      .insert(centres)
      .values({
        name: 'Worker Reminder Centre',
        address: '2 Worker St',
        city: 'Toronto',
        notes: 'Bring ID',
      })
      .returning({ id: centres.id });
    const staffRows = await db
      .insert(staff)
      .values({
        legalName: 'Worker Carer',
        email: 'worker-carer@example.test',
        phone: '4165550101',
      })
      .returning({ id: staff.id });

    const shiftDate = '2027-08-01';
    const startTime = '09:00:00';
    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId: centreRows[0]!.id,
        shiftDate,
        startTime,
        endTime: '17:00:00',
        status: 'filled',
        assignedStaffId: staffRows[0]!.id,
      })
      .returning({ id: shifts.id });

    const row = await scheduled.schedule({
      idempotencyKey: buildShiftReminderIdempotencyKey({
        shiftId: shiftRows[0]!.id,
        assignedStaffId: staffRows[0]!.id,
        shiftDate,
        startTime,
        interval: '2h',
      }),
      communicationType: 'shift_reminder_2h',
      entityType: 'shift',
      entityId: shiftRows[0]!.id,
      recipientType: 'carer',
      recipientEntityId: staffRows[0]!.id,
      scheduledFor: new Date(Date.now() - 1000),
    });

    await automated.enqueueScheduledCommunication(row.id);

    await vi.waitFor(
      async () => {
        const latest = await scheduled.findById(row.id);
        expect(latest?.status).toBe('sent');
      },
      { timeout: 15_000, interval: 250 },
    );

    const sent = recording.sent.find((m) => m.to === 'worker-carer@example.test');
    expect(sent?.subject).toContain('2 hours');
    expect(sent?.text).toContain('Bring ID');
  }, 20_000);
});
