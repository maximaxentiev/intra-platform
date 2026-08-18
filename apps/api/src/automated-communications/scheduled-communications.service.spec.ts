import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureCommunicationsTables } from './test-communications-schema.util';
import * as schema from '../db/schema';
import { communicationDeliveries, scheduledCommunications } from '../db/schema';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { AutomatedCommunicationsService } from './automated-communications.service';
import { CommunicationsQueueService } from './communications-queue.service';

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

describe.runIf(POSTGRES_READY)('ScheduledCommunicationsService', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let scheduled: ScheduledCommunicationsService;
  let automated: AutomatedCommunicationsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    await ensureCommunicationsTables(pool);

    scheduled = new ScheduledCommunicationsService(db);
    const config = {
      get: (key: string) => {
        if (key === 'REDIS_URL') return process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
        if (key === 'COMMUNICATIONS_QUEUE_PREFIX') return 'intra-test-sched';
        return undefined;
      },
      getOrThrow: (key: string) => {
        const v = key === 'REDIS_URL' ? process.env.REDIS_URL ?? 'redis://127.0.0.1:6380' : undefined;
        if (!v) throw new Error(`missing ${key}`);
        return v;
      },
    } as ConfigService;
    const queue = new CommunicationsQueueService(config);
    automated = new AutomatedCommunicationsService(scheduled, queue);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('enforces unique idempotency key via schedule reuse', async () => {
    const key = `test:schedule:unique:${Date.now()}`;
    const input = {
      idempotencyKey: key,
      communicationType: 'test_ping' as const,
      entityType: 'test' as const,
      entityId: '22222222-2222-4222-8222-222222222222',
      recipientType: 'test' as const,
      scheduledFor: new Date(Date.now() + 60_000),
    };

    const first = await scheduled.schedule(input);
    const second = await scheduled.schedule(input);
    expect(second.id).toBe(first.id);
  });

  it('supports transaction executor for schedule + cancel', async () => {
    const entityId = '33333333-3333-4333-8333-333333333333';
    const key = `test:tx:${Date.now()}`;

    await db.transaction(async (tx) => {
      await scheduled.schedule(
        {
          idempotencyKey: key,
          communicationType: 'test_ping',
          entityType: 'test',
          entityId,
          recipientType: 'test',
          scheduledFor: new Date(Date.now() + 120_000),
        },
        tx,
      );
      await scheduled.cancelByEntity('test', entityId, tx);
    });

    const row = await db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, key));
    expect(row[0]?.status).toBe('cancelled');
  }, 20_000);

  it('records append-only delivery attempts', async () => {
    const key = `test:delivery:${Date.now()}`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '44444444-4444-4444-8444-444444444444',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 120_000),
    });

    await scheduled.recordDeliveryAttempt({
      scheduledCommunicationId: row.id,
      idempotencyKey: key,
      attemptNumber: 1,
      recipientEmail: 'a@example.test',
      status: 'failed',
      failureCode: 'delivery_failed',
      failureReason: 'timeout',
    });
    await scheduled.recordDeliveryAttempt({
      scheduledCommunicationId: row.id,
      idempotencyKey: key,
      attemptNumber: 2,
      recipientEmail: 'a@example.test',
      status: 'sent',
      providerId: 'provider-1',
      sentAt: new Date(),
    });

    const deliveries = await db
      .select()
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.scheduledCommunicationId, row.id));
    expect(deliveries).toHaveLength(2);
  }, 20_000);

  it('recovers stale processing rows', async () => {
    const key = `test:stale:${Date.now()}`;
    const row = await scheduled.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '55555555-5555-4555-8555-555555555555',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 120_000),
    });

    await db
      .update(scheduledCommunications)
      .set({
        status: 'processing',
        updatedAt: new Date(Date.now() - 20 * 60_000),
      })
      .where(eq(scheduledCommunications.id, row.id));

    const recovered = await scheduled.recoverStaleProcessing();
    expect(recovered).toBeGreaterThanOrEqual(1);

    const updated = await scheduled.findById(row.id);
    expect(updated?.status).toBe('scheduled');
  });

  it('schedule without executor does not require queue for tx-only callers', async () => {
    const key = `test:no-enqueue:${Date.now()}`;
    const row = await automated.schedule({
      idempotencyKey: key,
      communicationType: 'test_ping',
      entityType: 'test',
      entityId: '66666666-6666-4666-8666-666666666666',
      recipientType: 'test',
      scheduledFor: new Date(Date.now() + 300_000),
    });
    expect(row.status).toBe('scheduled');
  });
});

describe.runIf(!POSTGRES_READY)('ScheduledCommunicationsService', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
