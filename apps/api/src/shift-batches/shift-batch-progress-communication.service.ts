import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, isNull, and } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import {
  centreContacts,
  centres,
  scheduledCommunications,
  shiftBatches,
  shifts,
} from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import {
  BATCH_PROGRESS_70_COMMUNICATION_TYPE,
  buildBatchProgress70IdempotencyKey,
} from './shift-batch-progress.types';
import {
  computeBatchProgressCounts,
  isBatchProgressEmailEligible,
} from './shift-batch-progress.util';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

export type BatchProgressEmailStatusDto =
  | { state: 'none' }
  | { state: 'scheduled'; scheduledAt: string }
  | { state: 'sending' }
  | { state: 'sent'; sentAt: string }
  | { state: 'failed'; reason: string; canRetry: true }
  | { state: 'blocked'; reason: string; canRetry: true };

type PrimaryContactResolution =
  | { ok: true; email: string }
  | { ok: false; reason: string; code: string };

@Injectable()
export class ShiftBatchProgressCommunicationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async evaluateAndSchedule(
    batchId: string,
    executor?: DbLike,
  ): Promise<string | null> {
    if (executor) {
      return this.evaluateAndScheduleInTransaction(batchId, executor);
    }
    return this.db.transaction(async (tx) => this.evaluateAndScheduleInTransaction(batchId, tx));
  }

  private async evaluateAndScheduleInTransaction(
    batchId: string,
    executor: DbLike,
  ): Promise<string | null> {
    const locked = await executor
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        progressEmailScheduledAt: shiftBatches.progressEmailScheduledAt,
        centreName: centres.name,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, batchId))
      .for('update')
      .limit(1);

    const batch = locked[0];
    if (!batch) return null;
    if (batch.requestCompletedAt) return null;
    if (batch.progressEmailScheduledAt) return null;

    const childRows = await executor
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));

    const progress = computeBatchProgressCounts(childRows);
    if (!isBatchProgressEmailEligible(progress)) return null;

    const primary = await this.resolvePrimaryContact(batch.centreId, executor);
    if (!primary.ok) {
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.batchProgressEmailBlocked,
          actorType: 'system',
          centreId: batch.centreId,
          entityId: batch.id,
          metadata: {
            batchId: batch.id,
            failureCode: primary.code,
            failureReason: primary.reason,
            fulfilledCount: progress.fulfilledCount,
            activeTotal: progress.activeTotal,
          },
        },
        executor,
      );
      return null;
    }

    const claimRows = await executor
      .update(shiftBatches)
      .set({ progressEmailScheduledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(shiftBatches.id, batchId),
          isNull(shiftBatches.progressEmailScheduledAt),
          isNull(shiftBatches.requestCompletedAt),
        ),
      )
      .returning({ id: shiftBatches.id });

    if (!claimRows[0]) return null;

    const scheduled = await this.automated.schedule(
      {
        idempotencyKey: buildBatchProgress70IdempotencyKey(batchId),
        communicationType: BATCH_PROGRESS_70_COMMUNICATION_TYPE,
        entityType: 'shift_batch',
        entityId: batchId,
        recipientType: 'centre',
        recipientEntityId: batch.centreId,
        scheduledFor: new Date(),
      },
      executor,
    );

    await this.platformAudit.record(
      {
        action: PLATFORM_AUDIT_ACTIONS.batchProgressEmailScheduled,
        actorType: 'system',
        centreId: batch.centreId,
        entityId: batch.id,
        metadata: {
          batchId: batch.id,
          fulfilledCount: progress.fulfilledCount,
          activeTotal: progress.activeTotal,
          recipientEmail: primary.email,
          scheduledCommunicationId: scheduled.id,
        },
      },
      executor,
    );

    return scheduled.id;
  }

  async enqueueScheduledId(id: string): Promise<void> {
    await this.automated.enqueueScheduledCommunication(id);
  }

  async maybeEvaluateAfterFulfillmentChange(batchId: string | null | undefined): Promise<void> {
    if (!batchId) return;
    const scheduledId = await this.evaluateAndSchedule(batchId);
    if (scheduledId) {
      await this.enqueueScheduledId(scheduledId);
    }
  }

  async resolveProgressEmailStatus(batchId: string): Promise<BatchProgressEmailStatusDto> {
    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        progressEmailScheduledAt: shiftBatches.progressEmailScheduledAt,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');

    const childRows = await this.db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));
    const progress = computeBatchProgressCounts(childRows);

    if (batch.requestCompletedAt || !isBatchProgressEmailEligible(progress)) {
      return { state: 'none' };
    }

    const idempotencyKey = buildBatchProgress70IdempotencyKey(batchId);
    const commRows = await this.db
      .select({
        status: scheduledCommunications.status,
        scheduledFor: scheduledCommunications.scheduledFor,
        updatedAt: scheduledCommunications.updatedAt,
        lastErrorReason: scheduledCommunications.lastErrorReason,
      })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
      .limit(1);

    const comm = commRows[0];
    if (comm) {
      if (comm.status === 'sent') {
        return {
          state: 'sent',
          sentAt: (comm.updatedAt ?? comm.scheduledFor).toISOString(),
        };
      }
      if (comm.status === 'failed') {
        return {
          state: 'failed',
          reason: comm.lastErrorReason ?? 'Delivery failed.',
          canRetry: true,
        };
      }
      if (comm.status === 'processing') {
        return { state: 'sending' };
      }
      if (batch.progressEmailScheduledAt) {
        return {
          state: 'scheduled',
          scheduledAt: batch.progressEmailScheduledAt.toISOString(),
        };
      }
    }

    if (!batch.progressEmailScheduledAt) {
      const primary = await this.resolvePrimaryContact(batch.centreId, this.db);
      if (!primary.ok) {
        return { state: 'blocked', reason: primary.reason, canRetry: true };
      }
    }

    return { state: 'none' };
  }

  async retryProgressEmail(batchId: string, actorUserId: string): Promise<{ scheduled: boolean }> {
    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        progressEmailScheduledAt: shiftBatches.progressEmailScheduledAt,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');
    if (batch.requestCompletedAt) {
      throw new NotFoundException('Batch is no longer open.');
    }

    const childRows = await this.db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));
    const progress = computeBatchProgressCounts(childRows);
    if (!isBatchProgressEmailEligible(progress)) {
      throw new NotFoundException('Batch is not eligible for a progress update.');
    }

    const idempotencyKey = buildBatchProgress70IdempotencyKey(batchId);
    const existing = await this.db
      .select()
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing[0]?.status === 'sent') {
      return { scheduled: false };
    }

    if (existing[0]?.status === 'failed' || existing[0]?.status === 'cancelled') {
      const primary = await this.resolvePrimaryContact(batch.centreId, this.db);
      if (!primary.ok) {
        throw new NotFoundException(primary.reason);
      }

      const row = await this.automated.ensureScheduled(
        {
          idempotencyKey,
          communicationType: BATCH_PROGRESS_70_COMMUNICATION_TYPE,
          entityType: 'shift_batch',
          entityId: batchId,
          recipientType: 'centre',
          recipientEntityId: batch.centreId,
          scheduledFor: new Date(),
        },
        this.db,
      );

      if (!batch.progressEmailScheduledAt) {
        await this.db
          .update(shiftBatches)
          .set({ progressEmailScheduledAt: new Date(), updatedAt: new Date() })
          .where(eq(shiftBatches.id, batchId));
      }

      await this.platformAudit.record({
        action: PLATFORM_AUDIT_ACTIONS.batchProgressEmailScheduled,
        actorType: 'ops_user',
        actorUserId,
        centreId: batch.centreId,
        entityId: batch.id,
        metadata: {
          batchId: batch.id,
          fulfilledCount: progress.fulfilledCount,
          activeTotal: progress.activeTotal,
          recipientEmail: primary.email,
          scheduledCommunicationId: row.id,
          source: 'retry',
        },
      });

      await this.enqueueScheduledId(row.id);
      return { scheduled: true };
    }

    const scheduledId = await this.evaluateAndSchedule(batchId);
    if (scheduledId) {
      await this.enqueueScheduledId(scheduledId);
      return { scheduled: true };
    }

    const primary = await this.resolvePrimaryContact(batch.centreId, this.db);
    if (!primary.ok) {
      throw new NotFoundException(primary.reason);
    }

    throw new NotFoundException('Progress update could not be scheduled.');
  }

  private async resolvePrimaryContact(
    centreId: string,
    executor: DbLike,
  ): Promise<PrimaryContactResolution> {
    const rows = await executor
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const raw = rows[0]?.email;
    if (!raw?.trim()) {
      return {
        ok: false,
        code: 'no_centre_primary_contact',
        reason: 'Centre has no primary contact email configured.',
      };
    }

    const normalized = normalizeNotificationEmail(raw);
    if (!normalized || !isValidNotificationEmail(normalized)) {
      return {
        ok: false,
        code: 'invalid_centre_email',
        reason: 'Centre primary contact email is invalid.',
      };
    }

    return { ok: true, email: normalized };
  }
}
