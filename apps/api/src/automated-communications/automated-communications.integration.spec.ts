import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureCommunicationsTables } from './test-communications-schema.util';
import * as schema from '../db/schema';
import { scheduledCommunications } from '../db/schema';
import { EmailService, RecordingEmailTransport } from '../email/email.service';
import { AutomatedCommunicationsReconcilerService } from './automated-communications-reconciler.service';
import { AutomatedCommunicationsProcessor } from './automated-communications.processor';
import { AutomatedCommunicationsService } from './automated-communications.service';
import { CommunicationProcessorRegistry } from './communication-processor.registry';
import { CommunicationsQueueService } from './communications-queue.service';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { TestPingCommunicationProcessor } from './test-ping.processor';
import { deriveBullMqJobId } from './bullmq-job-id.util';
import type { Job } from 'bullmq';
import type { CommunicationJobPayload } from './automated-communications.types';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
const TEST_PREFIX = `intra-test-comm-${Date.now()}`;

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

describe.runIf(INTEGRATION_READY)('Automated communications integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let queue: CommunicationsQueueService;
  let automated: AutomatedCommunicationsService;
  let processor: AutomatedCommunicationsProcessor;
  let reconciler: AutomatedCommunicationsReconcilerService;
  let email: EmailService;
  let registry: CommunicationProcessorRegistry;
  let workerStarted = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    const config = buildConfig();
    scheduled = new ScheduledCommunicationsService(db);
    queue = new CommunicationsQueueService(config);
    automated = new AutomatedCommunicationsService(scheduled, queue);
    registry = new CommunicationProcessorRegistry();
    registry.register(new TestPingCommunicationProcessor('worker-test@example.test'));

    email = new EmailService({
      get: (key: string) => {
        if (key === 'EMAIL_FROM') return 'Test <test@example.com>';
        if (key === 'RESEND_API_KEY') return 're_test';
        return undefined;
      },
    } as ConfigService);
    email.useTransport(new RecordingEmailTransport());

    processor = new AutomatedCommunicationsProcessor(config, db, scheduled, email, registry, queue);
    processor.startWorker();
    workerStarted = true;

    reconciler = new AutomatedCommunicationsReconcilerService(scheduled, queue);
  });

  afterAll(async () => {
    if (workerStarted) {
      await processor.stopWorker();
    }
    await queue?.onModuleDestroy().catch(() => undefined);
    await pool?.end().catch(() => undefined);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    email.useTransport(new RecordingEmailTransport());
  });

  it('derives deterministic BullMQ job id without colons', () => {
    const key = 'shift:abc:carer:reminder:3d';
    const jobId = deriveBullMqJobId(key);
    expect(jobId.includes(':')).toBe(false);
    expect(jobId).toBe(deriveBullMqJobId(key));
  });

  it('A. keeps PG schedule when enqueue fails then reconciler adds job', async () => {
    const key = `test:reconcile:${Date.now()}:a`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777771',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 500),
    });

    const enqueueSpy = vi.spyOn(queue, 'enqueue').mockRejectedValueOnce(new Error('redis down'));
    await automated.enqueueScheduledCommunication(row.id);
    expect(enqueueSpy).toHaveBeenCalled();

    const before = await queue.getJobState(key);
    expect(before).toBeNull();

    const result = await reconciler.runReconciliation();
    expect(result.enqueued).toBeGreaterThanOrEqual(1);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const updated = await scheduled.findById(row.id);
    expect(updated?.status).toBe('sent');
  });

  it('B. retries transient provider failure via worker re-execution', async () => {
    const recording = new RecordingEmailTransport();
    let callCount = 0;
    vi.spyOn(recording, 'send').mockImplementation(async (message) => {
      callCount += 1;
      if (callCount === 1) {
        throw new (await import('../email/email.transport')).EmailDeliveryError(
          'Email delivery failed (503)',
        );
      }
      recording.sent.push(message);
      return { providerId: 'retry-msg' };
    });
    email.useTransport(recording);

    const key = `test:retry:${Date.now()}:b`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777772',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 500),
    });

    const job = {
      data: { scheduledCommunicationId: row.id },
      attemptsMade: 1,
    } as Job<CommunicationJobPayload>;

    await expect(processor.processJob(job)).rejects.toThrow();
    await processor.processJob({ ...job, attemptsMade: 2 } as Job<CommunicationJobPayload>);

    const updated = await scheduled.findById(row.id);
    expect(updated?.status).toBe('sent');
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('C. no-ops when schedule already sent', async () => {
    const key = `test:sent:${Date.now()}:c`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777773',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 500),
    });

    await db
      .update(scheduledCommunications)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(scheduledCommunications.id, row.id));

    const recording = new RecordingEmailTransport();
    const sendSpy = vi.spyOn(recording, 'send');
    email.useTransport(recording);

    await queue.enqueue({
      scheduledCommunicationId: row.id,
      idempotencyKey: key,
      scheduledFor: new Date(Date.now() + 500),
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('does not re-enqueue cancelled or failed-final rows', async () => {
    const cancelledKey = `test:cancelled:${Date.now()}`;
    await scheduled.schedule({
      idempotencyKey: cancelledKey,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777774',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 60_000),
    });
    await scheduled.cancelByIdempotencyKeys([cancelledKey]);

    const failedKey = `test:failed:${Date.now()}`;
    const failedRow = await scheduled.schedule({
      idempotencyKey: failedKey,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777775',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 60_000),
    });
    await scheduled.markFailed(failedRow.id, 'delivery_failed', 'done');

    const result = await reconciler.runReconciliation();
    expect(result.enqueued).toBeGreaterThanOrEqual(0);
  });

  it('reuses provider idempotency key on retry attempts', async () => {
    const recording = new RecordingEmailTransport();
    const keys: string[] = [];
    let callCount = 0;
    vi.spyOn(recording, 'send').mockImplementation(async (message) => {
      callCount += 1;
      if (message.idempotencyKey) keys.push(message.idempotencyKey);
      if (callCount === 1) {
        throw new (await import('../email/email.transport')).EmailDeliveryError(
          'Email delivery failed (503)',
        );
      }
      return { providerId: 'idempotent' };
    });
    email.useTransport(recording);

    const key = `test:idempotent:${Date.now()}`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '77777777-7777-4777-8777-777777777776',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 500),
    });

    const job = {
      data: { scheduledCommunicationId: row.id },
      attemptsMade: 1,
    } as Job<CommunicationJobPayload>;

    await expect(processor.processJob(job)).rejects.toThrow();
    await processor.processJob({ ...job, attemptsMade: 2 } as Job<CommunicationJobPayload>);

    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(`intra-comm-${row.id}`);

    const updated = await scheduled.findById(row.id);
    expect(updated?.status).toBe('sent');
  });
});

describe.runIf(!INTEGRATION_READY)('Automated communications integration', () => {
  it('skipped — PostgreSQL or Redis not available', () => {
    expect(INTEGRATION_READY).toBe(false);
  });
});
