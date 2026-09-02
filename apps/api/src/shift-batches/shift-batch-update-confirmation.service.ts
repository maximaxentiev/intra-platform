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
import { ShiftBatchChangeHistoryService } from './shift-batch-change-history.service';
import { isBatchConfirmationStale } from './shift-batch-confirmation-state.util';
import {
  BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE,
  buildBatchConfirmationRevisionIdempotencyKey,
  type BatchUpdateReadinessDto,
} from './shift-batch-completion.types';
import { computeBatchProgressCounts } from './shift-batch-progress.util';

@Injectable()
export class ShiftBatchUpdateConfirmationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
    private readonly platformAudit: PlatformAuditService,
    private readonly changeHistory: ShiftBatchChangeHistoryService,
    private readonly shareLifecycle: StaffDocumentShareLifecycleService,
  ) {}

  async getUpdateReadiness(batchId: string): Promise<BatchUpdateReadinessDto> {
    const batch = await this.loadBatch(batchId);
    const childRows = await this.loadChildStatuses(batchId);
    const progress = computeBatchProgressCounts(childRows);
    const detectedChanges = await this.changeHistory.getDetectedChanges({
      batchId,
      since: batch.lastConfirmationScheduledAt,
    });

    const stale = isBatchConfirmationStale(batch);
    const blockers: BatchUpdateReadinessDto['blockers'] = [];

    if (!batch.requestCompletedAt) {
      blockers.push({
        code: 'batch_not_confirmed',
        message: 'Batch has not been confirmed to the Centre yet.',
      });
    } else if (!stale) {
      blockers.push({
        code: 'batch_not_stale',
        message: 'Centre confirmation is already up to date.',
      });
    }

    if (progress.activeTotal === 0) {
      blockers.push({
        code: 'no_active_shifts',
        message: 'This Batch Request has no active shifts.',
      });
    }

    const fulfillmentBlockers = await this.validateFulfillmentBlockers(batchId);
    blockers.push(...fulfillmentBlockers);

    const ready =
      stale &&
      blockers.length === 0 &&
      progress.activeTotal > 0 &&
      progress.fulfilledCount === progress.activeTotal;

    const primary = await this.resolvePrimaryContact(batch.centreId);

    return {
      ready,
      stale,
      confirmationRevision: batch.confirmationRevision,
      pendingChangeRevision: batch.pendingChangeRevision,
      primaryContactEmail: primary.ok ? primary.email : null,
      activeShiftCount: progress.activeTotal,
      fulfilledShiftCount: progress.fulfilledCount,
      detectedChanges,
      blockers,
    };
  }

  async scheduleUpdate(
    batchId: string,
    actorUserId: string,
    selectedChangeIds: string[],
    expectedPendingChangeRevision?: number,
  ) {
    const batchSnapshot = await this.loadBatch(batchId);
    if (
      batchSnapshot.requestCompletedAt &&
      batchSnapshot.pendingChangeRevision <= 0 &&
      batchSnapshot.confirmationRevision >= 2
    ) {
      const idempotencyKey = buildBatchConfirmationRevisionIdempotencyKey(
        batchId,
        batchSnapshot.confirmationRevision,
      );
      const existing = await this.db
        .select({ id: scheduledCommunications.id })
        .from(scheduledCommunications)
        .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing[0]) {
        return { scheduled: true, scheduledCommunicationId: existing[0].id };
      }
    }

    const readiness = await this.getUpdateReadiness(batchId);
    if (!readiness.ready) {
      throw new ConflictException({
        message: 'Batch is not ready to send update confirmation.',
        blockers: readiness.blockers,
      });
    }

    const selected = new Set(selectedChangeIds);
    const highlightedChanges = readiness.detectedChanges
      .filter((change) => selected.has(change.id))
      .map((change) => change.summary);

    const scheduledId = await this.db.transaction(async (tx) => {
      const batchRows = await tx
        .select()
        .from(shiftBatches)
        .where(eq(shiftBatches.id, batchId))
        .for('update')
        .limit(1);

      const batch = batchRows[0];
      if (!batch?.requestCompletedAt) {
        throw new ConflictException('Batch has not been confirmed.');
      }
      if (batch.cancelledAt) {
        throw new ConflictException('This Batch Request has been cancelled.');
      }
      if (batch.pendingChangeRevision <= 0) {
        const idempotencyKey = buildBatchConfirmationRevisionIdempotencyKey(
          batchId,
          batch.confirmationRevision,
        );
        const existing = await tx
          .select({ id: scheduledCommunications.id })
          .from(scheduledCommunications)
          .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
          .limit(1);
        if (existing[0]) return existing[0].id;
        throw new ConflictException('Batch confirmation is already current.');
      }

      if (
        expectedPendingChangeRevision != null &&
        batch.pendingChangeRevision !== expectedPendingChangeRevision
      ) {
        throw new ConflictException({
          message: 'Batch changes were updated while you were reviewing. Refresh and try again.',
          code: 'stale_pending_change_revision',
        });
      }

      const fulfillmentBlockers = await this.validateFulfillmentBlockers(batchId);
      if (fulfillmentBlockers.length > 0) {
        throw new ConflictException({
          message: 'Batch is no longer ready to send update confirmation.',
          blockers: fulfillmentBlockers,
        });
      }

      const nextRevision = batch.confirmationRevision + 1;
      const idempotencyKey = buildBatchConfirmationRevisionIdempotencyKey(batchId, nextRevision);

      const existing = await tx
        .select({ id: scheduledCommunications.id })
        .from(scheduledCommunications)
        .where(eq(scheduledCommunications.idempotencyKey, idempotencyKey))
        .limit(1);

      const primary = await this.resolvePrimaryContact(batch.centreId);
      if (!primary.ok) {
        throw new ConflictException(primary.reason);
      }

      const activeStaffIds = await this.loadActiveAssigneeIds(tx, batchId);
      for (const staffId of activeStaffIds) {
        await this.ensureDocumentShareUrl(tx, staffId, actorUserId);
      }

      const scheduled =
        existing[0] != null
          ? { id: existing[0].id }
          : await this.automated.schedule(
              {
                idempotencyKey,
                communicationType: BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE,
                entityType: 'shift_batch',
                entityId: batchId,
                recipientType: 'centre',
                recipientEntityId: batch.centreId,
                scheduledFor: new Date(),
              },
              tx,
            );

      const now = new Date();
      await tx
        .update(shiftBatches)
        .set({
          confirmationRevision: nextRevision,
          pendingChangeRevision: 0,
          lastConfirmationScheduledAt: now,
          updatedAt: now,
        })
        .where(eq(shiftBatches.id, batchId));

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.batchUpdateConfirmationScheduled,
          actorType: 'ops_user',
          actorUserId,
          centreId: batch.centreId,
          entityId: batch.id,
          metadata: {
            batchId: batch.id,
            confirmationRevision: nextRevision,
            selectedChangeIds,
            highlightedChanges,
            scheduledCommunicationId: scheduled.id,
            recipientEmail: primary.email,
          },
        },
        tx,
      );

      return scheduled.id;
    });

    if (scheduledId) {
      await this.automated.enqueueScheduledCommunication(scheduledId);
    }

    return { scheduled: true, scheduledCommunicationId: scheduledId };
  }

  async retryUpdateConfirmation(batchId: string, actorUserId: string) {
    const batch = await this.loadBatch(batchId);
    if (batch.confirmationRevision < 2) {
      throw new ConflictException('No update confirmation to retry.');
    }

    const idempotencyKey = buildBatchConfirmationRevisionIdempotencyKey(
      batchId,
      batch.confirmationRevision,
    );
    const row = await this.automated.ensureScheduled(
      {
        idempotencyKey,
        communicationType: BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE,
        entityType: 'shift_batch',
        entityId: batchId,
        recipientType: 'centre',
        recipientEntityId: batch.centreId,
        scheduledFor: new Date(),
      },
      this.db,
    );

    if (row.status !== 'processing') {
      await this.automated.enqueueScheduledCommunication(row.id);
    }

    await this.platformAudit.record({
      action: PLATFORM_AUDIT_ACTIONS.batchUpdateConfirmationScheduled,
      actorType: 'ops_user',
      actorUserId,
      centreId: batch.centreId,
      entityId: batch.id,
      metadata: { batchId, confirmationRevision: batch.confirmationRevision, source: 'retry' },
    });

    return { scheduled: true, scheduledCommunicationId: row.id };
  }

  private async validateFulfillmentBlockers(batchId: string) {
    const childRows = await this.db
      .select({
        id: shifts.id,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));

    const blockers: BatchUpdateReadinessDto['blockers'] = [];
    const active = childRows.filter((row) => row.status !== 'cancelled');

    for (const child of active) {
      if (child.status === 'pending' || !child.assignedStaffId) {
        blockers.push({
          code: 'unfilled_shift',
          shiftId: child.id,
          shiftDate: String(child.shiftDate),
          startTime: String(child.startTime),
          endTime: String(child.endTime),
          message: 'One or more active shifts are still unfilled.',
        });
      }
    }

    return blockers;
  }

  private async loadBatch(batchId: string) {
    const rows = await this.db
      .select()
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);
    const batch = rows[0];
    if (!batch) throw new NotFoundException('Batch not found.');
    return batch;
  }

  private async loadChildStatuses(batchId: string) {
    return this.db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));
  }

  private async loadActiveAssigneeIds(executor: DbExecutor, batchId: string) {
    const childRows = await executor
      .select({ assignedStaffId: shifts.assignedStaffId, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, batchId));

    return [
      ...new Set(
        childRows
          .filter((row) => row.status !== 'cancelled' && row.assignedStaffId)
          .map((row) => row.assignedStaffId as string),
      ),
    ];
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

    const generated = await this.shareLifecycle.generateShareLink(staffId, actorUserId, executor);
    return generated.shareUrl;
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
}
