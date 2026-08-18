import { ConfigService } from '@nestjs/config';
import { and, eq, inArray } from 'drizzle-orm';
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
  centreContacts,
  centres,
  scheduledCommunications,
  shifts,
  staff,
} from '../db/schema';
import { EmailService, RecordingEmailTransport } from '../email/email.service';
import { ShiftCancellationService } from './shift-cancellation.service';
import { registerShiftCancellationProcessors } from './shift-cancellation.processor';
import { ShiftReminderService } from './shift-reminder.service';
import { torontoShiftStartInstant } from './shift-toronto.util';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const TEST_PREFIX = `intra-test-cancel-${Date.now()}`;

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

describe.runIf(POSTGRES_READY)('Shift cancellation PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let automated: AutomatedCommunicationsService;
  let cancellations: ShiftCancellationService;
  let reminders: ShiftReminderService;
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
    cancellations = new ShiftCancellationService(db, automated);
    reminders = new ShiftReminderService(db, automated);

    const centreRows = await db
      .insert(centres)
      .values({
        name: 'Cancellation Test Centre',
        address: '9 Cancel St',
        city: 'Toronto',
        notes: 'Internal only',
      })
      .returning({ id: centres.id });
    centreId = centreRows[0]!.id;

    await db.insert(centreContacts).values({
      centreId,
      email: 'centre-cancel@example.test',
      sortOrder: 0,
    });

    const staffRows = await db
      .insert(staff)
      .values({
        legalName: 'Cancel Carer',
        email: 'carer-cancel@example.test',
        phone: '4165550199',
      })
      .returning({ id: staff.id });
    staffId = staffRows[0]!.id;
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('creates one centre + one carer cancellation pair per event', async () => {
    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId,
        shiftDate: '2027-09-01',
        startTime: '09:00:00',
        endTime: '17:00:00',
        status: 'filled',
        assignedStaffId: staffId,
      })
      .returning({ id: shifts.id });
    const shiftId = shiftRows[0]!.id;
    const cancelledAt = new Date();

    const ids = await cancellations.scheduleForAssignedCancellation(
      {
        shiftId,
        assignedStaffId: staffId,
        centreId,
        scheduledFor: cancelledAt,
      },
      db,
    );
    expect(ids).toHaveLength(2);

    const again = await cancellations.scheduleForAssignedCancellation(
      {
        shiftId,
        assignedStaffId: staffId,
        centreId,
        scheduledFor: cancelledAt,
      },
      db,
    );
    expect(again).toEqual(ids);
  });

  it('cancels pending reminders and creates cancellation rows on cancel', async () => {
    const shiftDate = '2027-10-01';
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
    await reminders.scheduleForFilledShift(
      { shiftId, assignedStaffId: staffId, shiftDate, startTime },
      db,
      now,
    );

    const cancelledAt = new Date();
    await db
      .update(shifts)
      .set({ status: 'cancelled', updatedAt: cancelledAt })
      .where(eq(shifts.id, shiftId));

    await reminders.cancelPendingForShift(shiftId, db);
    await cancellations.scheduleForAssignedCancellation(
      { shiftId, assignedStaffId: staffId, centreId, scheduledFor: cancelledAt },
      db,
    );

    const reminderRows = await db
      .select()
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityId, shiftId),
          inArray(scheduledCommunications.communicationType, [
            'shift_reminder_3d',
            'shift_reminder_1d',
            'shift_reminder_2h',
          ]),
        ),
      );
    expect(reminderRows.every((r) => r.status === 'cancelled')).toBe(true);

    const cancelRows = await db
      .select()
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityId, shiftId),
          inArray(scheduledCommunications.communicationType, [
            'shift_cancellation_centre',
            'shift_cancellation_carer',
          ]),
        ),
      );
    expect(cancelRows).toHaveLength(2);
  });

  it('supports a second cancellation cycle after recancel with new version', async () => {
    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId,
        shiftDate: '2027-11-01',
        startTime: '10:00:00',
        endTime: '18:00:00',
        status: 'filled',
        assignedStaffId: staffId,
      })
      .returning({ id: shifts.id });
    const shiftId = shiftRows[0]!.id;

    const firstAt = new Date('2027-08-01T12:00:00.000Z');
    await cancellations.scheduleForAssignedCancellation(
      { shiftId, assignedStaffId: staffId, centreId, scheduledFor: firstAt },
      db,
    );

    const secondAt = new Date('2027-08-02T12:00:00.000Z');
    await cancellations.scheduleForAssignedCancellation(
      { shiftId, assignedStaffId: staffId, centreId, scheduledFor: secondAt },
      db,
    );

    const rows = await db
      .select()
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityId, shiftId),
          inArray(scheduledCommunications.communicationType, [
            'shift_cancellation_centre',
            'shift_cancellation_carer',
          ]),
        ),
      );
    expect(rows).toHaveLength(4);
  });
});

describe.runIf(POSTGRES_READY && REDIS_READY)('Shift cancellation worker integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let queue: CommunicationsQueueService;
  let automated: AutomatedCommunicationsService;
  let processor: AutomatedCommunicationsProcessor;
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
    registerShiftCancellationProcessors(registry, config);

    recording = new RecordingEmailTransport();
    const email = new EmailService({
      get: (key: string) => {
        if (key === 'EMAIL_FROM') return 'Test <test@example.com>';
        if (key === 'RESEND_API_KEY') return 're_test';
        return undefined;
      },
    } as ConfigService);
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

  it('processes centre and carer cancellation emails independently', async () => {
    const centreRows = await db
      .insert(centres)
      .values({
        name: 'Worker Cancel Centre',
        address: '3 Worker St',
        city: 'Toronto',
      })
      .returning({ id: centres.id });
    await db.insert(centreContacts).values({
      centreId: centreRows[0]!.id,
      email: 'worker-centre-cancel@example.test',
      sortOrder: 0,
    });

    const staffRows = await db
      .insert(staff)
      .values({
        legalName: 'Worker Cancel Carer',
        email: 'worker-carer-cancel@example.test',
        phone: '4165550102',
      })
      .returning({ id: staff.id });

    const shiftRows = await db
      .insert(shifts)
      .values({
        centreId: centreRows[0]!.id,
        shiftDate: '2027-12-01',
        startTime: '09:00:00',
        endTime: '17:00:00',
        status: 'cancelled',
        assignedStaffId: staffRows[0]!.id,
        cancellationReason: 'Family emergency internal',
      })
      .returning({ id: shifts.id, updatedAt: shifts.updatedAt });

    const cancelledAt = shiftRows[0]!.updatedAt;
    const version = String(cancelledAt.getTime());

    const centreRow = await scheduled.schedule({
      idempotencyKey: `shift:${shiftRows[0]!.id}:cancellation:${version}:centre`,
      communicationType: 'shift_cancellation_centre',
      entityType: 'shift',
      entityId: shiftRows[0]!.id,
      recipientType: 'centre',
      recipientEntityId: centreRows[0]!.id,
      scheduledFor: cancelledAt,
    });
    const carerRow = await scheduled.schedule({
      idempotencyKey: `shift:${shiftRows[0]!.id}:cancellation:${version}:carer`,
      communicationType: 'shift_cancellation_carer',
      entityType: 'shift',
      entityId: shiftRows[0]!.id,
      recipientType: 'carer',
      recipientEntityId: staffRows[0]!.id,
      scheduledFor: cancelledAt,
    });

    await automated.enqueueScheduledCommunication(centreRow.id);
    await automated.enqueueScheduledCommunication(carerRow.id);

    await vi.waitFor(
      async () => {
        const centreLatest = await scheduled.findById(centreRow.id);
        const carerLatest = await scheduled.findById(carerRow.id);
        expect(centreLatest?.status).toBe('sent');
        expect(carerLatest?.status).toBe('sent');
      },
      { timeout: 15_000, interval: 250 },
    );

    const centreSent = recording.sent.find((m) => m.to === 'worker-centre-cancel@example.test');
    const carerSent = recording.sent.find((m) => m.to === 'worker-carer-cancel@example.test');
    expect(centreSent?.subject).toContain('Shift cancelled');
    expect(carerSent?.subject).toContain('Shift cancelled');
    expect(centreSent?.text).not.toContain('Family emergency');
    expect(carerSent?.text).not.toContain('Family emergency');
  }, 20_000);
});
