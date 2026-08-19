import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { communicationDeliveries, scheduledCommunications } from '../db/schema';
import type {
  CommunicationDeliveryStatus,
  ScheduleCommunicationInput,
  ScheduledCommunicationStatus,
} from './automated-communications.types';
import {
  COMMUNICATION_FAILURE_CODE,
  STALE_PROCESSING_THRESHOLD_MS,
} from './automated-communications.constants';
import { sanitizeCommunicationFailureReason } from './communication-retry.util';

const SCHEDULE_SYNC_TOLERANCE_MS = 1000;

type DbLike = Pick<Database, 'select' | 'insert' | 'update'>;

@Injectable()
export class ScheduledCommunicationsService {
  private readonly logger = new Logger(ScheduledCommunicationsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async schedule(
    input: ScheduleCommunicationInput,
    executor: DbLike = this.db,
  ) {
    const existing = await executor
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    try {
      const rows = await executor
        .insert(scheduledCommunications)
        .values({
          idempotencyKey: input.idempotencyKey,
          communicationType: input.communicationType,
          entityType: input.entityType,
          entityId: input.entityId,
          recipientType: input.recipientType,
          recipientEntityId: input.recipientEntityId ?? null,
          scheduledFor: input.scheduledFor,
          status: 'scheduled',
        })
        .returning();

      return rows[0]!;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('scheduled_communications_idempotency_key_idx')) {
        throw error;
      }

      const retry = await executor
        .select()
        .from(scheduledCommunications)
        .where(eq(scheduledCommunications.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (retry[0]) {
        return retry[0];
      }

      throw error;
    }
  }

  /** Idempotent schedule that reactivates cancelled/failed rows when still applicable. */
  async ensureScheduled(
    input: ScheduleCommunicationInput,
    executor: DbLike = this.db,
  ) {
    const existing = await executor
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (!existing[0]) {
      return this.schedule(input, executor);
    }

    const row = existing[0];
    if (row.status === 'sent') {
      return row;
    }

    if (row.status === 'scheduled' || row.status === 'processing') {
      const sameSchedule =
        Math.abs(row.scheduledFor.getTime() - input.scheduledFor.getTime()) <=
        SCHEDULE_SYNC_TOLERANCE_MS;
      const sameRecipient =
        (row.recipientEntityId ?? null) === (input.recipientEntityId ?? null);

      if (sameSchedule && sameRecipient) {
        return row;
      }

      if (row.status === 'processing') {
        return row;
      }

      const rows = await executor
        .update(scheduledCommunications)
        .set({
          scheduledFor: input.scheduledFor,
          recipientEntityId: input.recipientEntityId ?? null,
          lastErrorCode: null,
          lastErrorReason: null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledCommunications.id, row.id))
        .returning();

      return rows[0] ?? row;
    }

    if (input.scheduledFor.getTime() <= Date.now()) {
      return row;
    }

    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'scheduled',
        scheduledFor: input.scheduledFor,
        cancelledAt: null,
        lastErrorCode: null,
        lastErrorReason: null,
        recipientEntityId: input.recipientEntityId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledCommunications.id, row.id))
      .returning();

    return rows[0] ?? row;
  }

  async cancelByIdempotencyKeys(keys: string[], executor: DbLike = this.db): Promise<number> {
    if (keys.length === 0) return 0;

    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(scheduledCommunications.idempotencyKey, keys),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .returning({ id: scheduledCommunications.id });

    return rows.length;
  }

  async cancelByEntity(
    entityType: string,
    entityId: string,
    executor: DbLike = this.db,
  ): Promise<number> {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledCommunications.entityType, entityType),
          eq(scheduledCommunications.entityId, entityId),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .returning({ id: scheduledCommunications.id });

    return rows.length;
  }

  async findById(id: string, executor: DbLike = this.db) {
    const rows = await executor
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listScheduledForReconciliation(limit = 500, executor: DbLike = this.db) {
    return executor
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.status, 'scheduled'))
      .orderBy(scheduledCommunications.scheduledFor)
      .limit(limit);
  }

  async markProcessing(id: string, executor: DbLike = this.db) {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'processing',
        attempts: sql`${scheduledCommunications.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledCommunications.id, id),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async markSent(id: string, executor: DbLike = this.db) {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'sent',
        lastErrorCode: null,
        lastErrorReason: null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledCommunications.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async markScheduledForRetry(
    id: string,
    code: string,
    reason: string,
    executor: DbLike = this.db,
  ) {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'scheduled',
        lastErrorCode: code,
        lastErrorReason: sanitizeCommunicationFailureReason(reason),
        updatedAt: new Date(),
      })
      .where(eq(scheduledCommunications.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async markFailed(
    id: string,
    code: string,
    reason: string,
    executor: DbLike = this.db,
  ) {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'failed',
        lastErrorCode: code,
        lastErrorReason: sanitizeCommunicationFailureReason(reason),
        updatedAt: new Date(),
      })
      .where(eq(scheduledCommunications.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async markCancelled(id: string, code: string, reason: string, executor: DbLike = this.db) {
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        lastErrorCode: code,
        lastErrorReason: sanitizeCommunicationFailureReason(reason),
        updatedAt: new Date(),
      })
      .where(eq(scheduledCommunications.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async recoverStaleProcessing(executor: DbLike = this.db): Promise<number> {
    const threshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
    const rows = await executor
      .update(scheduledCommunications)
      .set({
        status: 'scheduled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledCommunications.status, 'processing'),
          sql`${scheduledCommunications.updatedAt} < ${threshold}`,
        ),
      )
      .returning({ id: scheduledCommunications.id });

    if (rows.length > 0) {
      this.logger.warn(`Recovered ${rows.length} stale processing communication(s).`);
    }

    return rows.length;
  }

  async recordDeliveryAttempt(params: {
    scheduledCommunicationId: string;
    idempotencyKey: string;
    attemptNumber: number;
    recipientEmail: string;
    status: CommunicationDeliveryStatus;
    providerId?: string | null;
    failureCode?: string | null;
    failureReason?: string | null;
    sentAt?: Date | null;
  }, executor: DbLike = this.db) {
    const rows = await executor
      .insert(communicationDeliveries)
      .values({
        scheduledCommunicationId: params.scheduledCommunicationId,
        idempotencyKey: params.idempotencyKey,
        attemptNumber: params.attemptNumber,
        recipientEmail: params.recipientEmail,
        status: params.status,
        providerId: params.providerId ?? null,
        failureCode: params.failureCode ?? null,
        failureReason: params.failureReason
          ? sanitizeCommunicationFailureReason(params.failureReason)
          : null,
        sentAt: params.sentAt ?? null,
      })
      .returning();

    return rows[0]!;
  }

  isTerminalStatus(status: ScheduledCommunicationStatus): boolean {
    return status === 'sent' || status === 'failed' || status === 'cancelled';
  }
}
