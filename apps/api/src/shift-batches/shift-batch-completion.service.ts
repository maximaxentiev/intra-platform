import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import {
  centreContacts,
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
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import {
  BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE,
  buildBatchConfirmationFinalIdempotencyKey,
  buildBatchConfirmationRevisionIdempotencyKey,
  type BatchFinalConfirmationStatusDto,
} from './shift-batch-completion.types';
import { isActiveFulfilledShift } from './shift-batch-completion.util';
import { computeBatchProgressCounts } from './shift-batch-progress.util';
import { buildBatchProgress70IdempotencyKey } from './shift-batch-progress.types';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

@Injectable()
export class ShiftBatchCompletionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
    private readonly platformAudit: PlatformAuditService,
    private readonly readiness: ShiftBatchCompletionReadinessService,
    private readonly shareLifecycle: StaffDocumentShareLifecycleService,
  ) {}

  async complete(batchId: string, actorUserId: string) {
    const existingBatch = await this.db
      .select({
        id: shiftBatches.id,
        requestCompletedAt: shiftBatches.requestCompletedAt,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    if (!existingBatch[0]) throw new NotFoundException('Batch not found.');
    if (existingBatch[0].requestCompletedAt) {
      const scheduledCommunicationId = await this.findExistingFinalCommunicationId(this.db, batchId);
      return { completed: true, scheduledCommunicationId };
    }

    const readiness = await this.readiness.getReadiness(batchId);
    if (!readiness.ready) {
      throw new ConflictException({
        message: 'Batch is not ready to complete.',
        blockers: readiness.blockers,
      });
    }

    const scheduledId = await this.db.transaction(async (tx) => {
      const batchRows = await tx
        .select({
          id: shiftBatches.id,
          centreId: shiftBatches.centreId,
          requestCompletedAt: shiftBatches.requestCompletedAt,
          cancelledAt: shiftBatches.cancelledAt,
        })
        .from(shiftBatches)
        .where(eq(shiftBatches.id, batchId))
        .for('update')
        .limit(1);

      const batch = batchRows[0];
      if (!batch) throw new NotFoundException('Batch not found.');
      if (batch.cancelledAt) {
        throw new ConflictException('This Batch Request has been cancelled.');
      }
      if (batch.requestCompletedAt) {
        return this.findExistingFinalCommunicationId(tx, batchId);
      }

      const childRows = await tx
        .select({
          id: shifts.id,
          status: shifts.status,
          assignedStaffId: shifts.assignedStaffId,
        })
        .from(shifts)
        .where(eq(shifts.batchId, batchId))
        .for('update');

      const validation = this.validateLockedChildren(childRows);
      if (!validation.ready) {
        throw new ConflictException({
          message: 'Batch is no longer ready to complete.',
          blockers: validation.blockers,
        });
      }

      const activeStaffIds = validation.activeStaffIds;

      for (const staffId of activeStaffIds) {
        await this.ensureDocumentShareUrl(tx, staffId, actorUserId);
      }

      const primary = await this.resolvePrimaryContact(batch.centreId);
      if (!primary.ok) {
        throw new ConflictException({
          message: 'Centre primary contact is no longer valid.',
          blockers: [{ code: 'missing_primary_contact', message: primary.reason }],
        });
      }

      await this.automated.cancelByIdempotencyKeys(
        [buildBatchProgress70IdempotencyKey(batchId)],
        tx,
      );

      const existingFinalId = await this.findExistingFinalCommunicationId(tx, batchId);
      const scheduled =
        existingFinalId != null
          ? { id: existingFinalId }
          : await this.automated.schedule(
              {
                idempotencyKey: buildBatchConfirmationFinalIdempotencyKey(batchId),
                communicationType: BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE,
                entityType: 'shift_batch',
                entityId: batchId,
                recipientType: 'centre',
                recipientEntityId: batch.centreId,
                scheduledFor: new Date(),
              },
              tx,
            );

      const completedAt = new Date();
      await tx
        .update(shiftBatches)
        .set({
          requestCompletedAt: completedAt,
          requestCompletedByUserId: actorUserId,
          confirmationRevision: 1,
          pendingChangeRevision: 0,
          lastConfirmationScheduledAt: completedAt,
          updatedAt: completedAt,
        })
        .where(eq(shiftBatches.id, batchId));

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.batchRequestCompleted,
          actorType: 'ops_user',
          actorUserId,
          centreId: batch.centreId,
          entityId: batch.id,
          metadata: {
            batchId: batch.id,
            activeShiftCount: validation.activeShiftCount,
            recipientEmail: primary.email,
            scheduledCommunicationId: scheduled.id,
          },
        },
        tx,
      );

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.batchFinalConfirmationScheduled,
          actorType: 'system',
          centreId: batch.centreId,
          entityId: batch.id,
          metadata: {
            batchId: batch.id,
            recipientEmail: primary.email,
            scheduledCommunicationId: scheduled.id,
          },
        },
        tx,
      );

      return scheduled.id;
    });

    if (scheduledId) {
      await this.automated.enqueueScheduledCommunication(scheduledId);
    }

    return { completed: true, scheduledCommunicationId: scheduledId };
  }

  async retryFinalConfirmation(batchId: string, actorUserId: string) {
    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');
    if (!batch.requestCompletedAt) {
      throw new ConflictException('Batch is not completed.');
    }

    const idempotencyKey = buildBatchConfirmationFinalIdempotencyKey(batchId);
    const existing = await this.db
      .select({
        id: scheduledCommunications.id,
        status: scheduledCommunications.status,
      })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
      .limit(1);

    const existingRow = existing[0];
    if (existingRow?.status === 'sent') {
      return { scheduled: false, reason: 'already_sent' as const };
    }
    if (existingRow?.status === 'processing') {
      return { scheduled: false, reason: 'in_progress' as const };
    }

    const primary = await this.resolvePrimaryContact(batch.centreId);
    if (!primary.ok) {
      throw new ConflictException(primary.reason);
    }

    const row = await this.automated.ensureScheduled(
      {
        idempotencyKey,
        communicationType: BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE,
        entityType: 'shift_batch',
        entityId: batchId,
        recipientType: 'centre',
        recipientEntityId: batch.centreId,
        scheduledFor: new Date(),
      },
      this.db,
    );

    if (row.status === 'sent') {
      return { scheduled: false, reason: 'already_sent' as const };
    }

    await this.platformAudit.record({
      action: PLATFORM_AUDIT_ACTIONS.batchFinalConfirmationScheduled,
      actorType: 'ops_user',
      actorUserId,
      centreId: batch.centreId,
      entityId: batch.id,
      metadata: {
        batchId: batch.id,
        recipientEmail: primary.email,
        scheduledCommunicationId: row.id,
        source: 'retry',
      },
    });

    if (row.status !== 'processing') {
      await this.automated.enqueueScheduledCommunication(row.id);
    }

    return { scheduled: true, scheduledCommunicationId: row.id };
  }

  async resolveFinalConfirmationStatus(batchId: string): Promise<BatchFinalConfirmationStatusDto> {
    const batchRows = await this.db
      .select({
        requestCompletedAt: shiftBatches.requestCompletedAt,
        confirmationRevision: shiftBatches.confirmationRevision,
        pendingChangeRevision: shiftBatches.pendingChangeRevision,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch?.requestCompletedAt) return { state: 'none' };

    const revision = batch.confirmationRevision > 0 ? batch.confirmationRevision : 1;
    const idempotencyKey = buildBatchConfirmationRevisionIdempotencyKey(batchId, revision);
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
    if (!comm) return { state: 'none' };

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
    return {
      state: 'scheduled',
      scheduledAt: comm.scheduledFor.toISOString(),
    };
  }

  private async ensureDocumentShareUrl(
    executor: DbExecutor,
    staffId: string,
    actorUserId: string,
  ) {
    const existing = await this.shareLifecycle.buildActiveStaffDocumentShareUrl(staffId);
    if (existing) return existing;

    const assessment = await this.shareLifecycle.assessDocumentShareReadiness(staffId);
    if (!assessment.ready) {
      throw new ConflictException({
        message: 'Document share unavailable for one or more assigned Carers.',
        code: 'document_share_unavailable',
        reason: assessment.reason,
      });
    }

    try {
      const generated = await this.shareLifecycle.generateShareLink(staffId, actorUserId, executor);
      return generated.shareUrl;
    } catch (err) {
      const reason =
        err instanceof ConflictException && typeof err.message === 'string'
          ? err.message
          : 'Document share could not be generated.';
      throw new ConflictException({
        message: 'Document share unavailable for one or more assigned Carers.',
        code: 'document_share_unavailable',
        reason,
      });
    }
  }

  private async findExistingFinalCommunicationId(executor: DbLike, batchId: string) {
    const rows = await executor
      .select({ id: scheduledCommunications.id })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.idempotencyKey, buildBatchConfirmationFinalIdempotencyKey(batchId)))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  private async resolvePrimaryContact(centreId: string) {
    const rows = await this.db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const raw = rows[0]?.email;
    if (!raw?.trim()) {
      return { ok: false as const, reason: 'Centre primary contact does not have a valid email.' };
    }

    const normalized = normalizeNotificationEmail(raw);
    if (!normalized || !isValidNotificationEmail(normalized)) {
      return { ok: false as const, reason: 'Centre primary contact does not have a valid email.' };
    }

    return { ok: true as const, email: normalized };
  }

  private validateLockedChildren(
    childRows: Array<{ id: string; status: string; assignedStaffId: string | null }>,
  ) {
    const progress = computeBatchProgressCounts(childRows);
    const blockers: Array<{ code: string; message: string }> = [];

    if (progress.activeTotal === 0) {
      blockers.push({
        code: 'no_active_shifts',
        message: 'This Batch Request has no active shifts to complete.',
      });
    }

    for (const child of childRows.filter((row) => row.status !== 'cancelled')) {
      if (child.status === 'pending') {
        blockers.push({ code: 'unfilled_shift', message: 'One or more active shifts are still unfilled.' });
      } else if (!child.assignedStaffId || !isActiveFulfilledShift(child.status)) {
        blockers.push({ code: 'missing_assignee', message: 'One or more active shifts have no assigned Carer.' });
      }
    }

    const activeStaffIds = [
      ...new Set(
        childRows
          .filter((row) => row.status !== 'cancelled' && row.assignedStaffId)
          .map((row) => row.assignedStaffId as string),
      ),
    ];

    return {
      ready: blockers.length === 0 && progress.activeTotal > 0 && progress.fulfilledCount === progress.activeTotal,
      blockers,
      activeStaffIds,
      activeShiftCount: progress.activeTotal,
    };
  }
}
