import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { shiftBatches, shifts } from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { cancellationReasonPreview } from '../shifts/shift-audit.util';
import type { ShiftCommunicationRecipientsDto } from '../shifts/dto/shift-communication-recipients.dto';
import { normalizeRequiredCancellationReason } from '../shifts/shifts-lifecycle.util';
import { ShiftReminderService } from '../shifts/shift-reminder.service';
import {
  BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE,
  BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE,
  buildBatchCancellationCarerIdempotencyKey,
  buildBatchCancellationCentreIdempotencyKey,
  deriveBatchCancellationVersion,
  isBatchChildCancellable,
  resolveBatchCancellationCase,
  resolveBatchCancellationRecipients,
  type BatchCancellationResultDto,
  type BatchCancellationShiftSummary,
} from './shift-batch-cancellation.types';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

@Injectable()
export class ShiftBatchCancellationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
    private readonly platformAudit: PlatformAuditService,
    private readonly shiftReminders: ShiftReminderService,
  ) {}

  async cancel(
    batchId: string,
    actorUserId: string,
    cancellationReason: string | undefined,
    communications?: ShiftCommunicationRecipientsDto,
  ): Promise<BatchCancellationResultDto> {
    const trimmedReason = normalizeRequiredCancellationReason(cancellationReason);
    let scheduledCommunicationIds: string[] = [];

    const result = await this.db.transaction(async (tx) => {
      const batchRows = await tx
        .select({
          id: shiftBatches.id,
          centreId: shiftBatches.centreId,
          requestCompletedAt: shiftBatches.requestCompletedAt,
          confirmationRevision: shiftBatches.confirmationRevision,
          cancelledAt: shiftBatches.cancelledAt,
          cancellationReason: shiftBatches.cancellationReason,
        })
        .from(shiftBatches)
        .where(eq(shiftBatches.id, batchId))
        .for('update')
        .limit(1);

      const batch = batchRows[0];
      if (!batch) throw new NotFoundException('Batch not found.');

      if (batch.cancelledAt) {
        return {
          cancelledAt: batch.cancelledAt,
          cancelledChildCount: 0,
          scheduledCommunicationIds: [] as string[],
          alreadyCancelled: true,
        };
      }

      const childRows = await tx
        .select({
          id: shifts.id,
          shiftDate: shifts.shiftDate,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          roleNeeded: shifts.roleNeeded,
          assignedStaffId: shifts.assignedStaffId,
          status: shifts.status,
          centreId: shifts.centreId,
        })
        .from(shifts)
        .where(eq(shifts.batchId, batchId))
        .for('update');

      const summaries: BatchCancellationShiftSummary[] = childRows.map((row) => ({
        id: row.id,
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
        assignedStaffId: row.assignedStaffId,
        status: row.status,
      }));

      const cancelCase = resolveBatchCancellationCase(batch, summaries);
      const effectiveRecipients = resolveBatchCancellationRecipients({
        cancelCase,
        requested: communications,
      });

      const cancellable = childRows.filter((row) => isBatchChildCancellable(row.status));
      const cancelledAt = new Date();
      const cancellationVersion = deriveBatchCancellationVersion(cancelledAt);

      await this.automated.cancelByEntity('shift_batch', batchId, tx);

      let cancelledChildCount = 0;
      const carerShiftMap = new Map<
        string,
        Array<{
          shiftDate: string;
          startTime: string;
          endTime: string;
          roleNeeded: string | null;
        }>
      >();

      for (const child of cancellable) {
        const updated = await tx
          .update(shifts)
          .set({
            status: 'cancelled',
            cancellationReason: trimmedReason,
            updatedAt: cancelledAt,
          })
          .where(eq(shifts.id, child.id))
          .returning({ id: shifts.id });

        if (!updated[0]) continue;
        cancelledChildCount += 1;

        await this.shiftReminders.cancelPendingForShift(child.id, tx);

        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftCancelled,
            actorType: 'ops_user',
            actorUserId,
            shiftId: child.id,
            centreId: child.centreId,
            staffId: child.assignedStaffId,
            entityId: child.id,
            metadata: {
              batchId,
              cancellationReasonPreview: cancellationReasonPreview(trimmedReason),
              source: 'batch_cancellation',
            },
          },
          tx,
        );

        if (child.assignedStaffId) {
          const list = carerShiftMap.get(child.assignedStaffId) ?? [];
          list.push({
            shiftDate: String(child.shiftDate),
            startTime: String(child.startTime),
            endTime: String(child.endTime),
            roleNeeded: child.roleNeeded,
          });
          carerShiftMap.set(child.assignedStaffId, list);
        }
      }

      await tx
        .update(shiftBatches)
        .set({
          cancelledAt,
          cancelledByUserId: actorUserId,
          cancellationReason: trimmedReason,
          updatedAt: cancelledAt,
        })
        .where(eq(shiftBatches.id, batchId));

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.batchRequestCancelled,
          actorType: 'ops_user',
          actorUserId,
          centreId: batch.centreId,
          entityId: batch.id,
          metadata: {
            batchId: batch.id,
            cancelledChildCount,
            cancellationReasonPreview: cancellationReasonPreview(trimmedReason),
            cancelCase,
            recipients: effectiveRecipients,
          },
        },
        tx,
      );

      const scheduledIds: string[] = [];

      if (effectiveRecipients.centre) {
        const centreRow = await this.automated.schedule(
          {
            idempotencyKey: buildBatchCancellationCentreIdempotencyKey({
              batchId,
              cancellationVersion,
            }),
            communicationType: BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE,
            entityType: 'shift_batch',
            entityId: batchId,
            recipientType: 'centre',
            recipientEntityId: batch.centreId,
            scheduledFor: cancelledAt,
          },
          tx,
        );
        scheduledIds.push(centreRow.id);

        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.batchCancellationCentreScheduled,
            actorType: 'system',
            centreId: batch.centreId,
            entityId: batch.id,
            metadata: {
              batchId: batch.id,
              scheduledCommunicationId: centreRow.id,
            },
          },
          tx,
        );
      }

      if (effectiveRecipients.carer) {
        for (const [staffId] of carerShiftMap) {
          const carerRow = await this.automated.schedule(
            {
              idempotencyKey: buildBatchCancellationCarerIdempotencyKey({
                batchId,
                cancellationVersion,
                staffId,
              }),
              communicationType: BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE,
              entityType: 'shift_batch',
              entityId: batchId,
              recipientType: 'carer',
              recipientEntityId: staffId,
              scheduledFor: cancelledAt,
            },
            tx,
          );
          scheduledIds.push(carerRow.id);

          await this.platformAudit.record(
            {
              action: PLATFORM_AUDIT_ACTIONS.batchCancellationCarerScheduled,
              actorType: 'system',
              centreId: batch.centreId,
              staffId,
              entityId: batch.id,
              metadata: {
                batchId: batch.id,
                scheduledCommunicationId: carerRow.id,
                staffId,
              },
            },
            tx,
          );
        }
      }

      return {
        cancelledAt,
        cancelledChildCount,
        scheduledCommunicationIds: scheduledIds,
        alreadyCancelled: false,
      };
    });

    if (result.scheduledCommunicationIds.length > 0) {
      for (const id of result.scheduledCommunicationIds) {
        await this.automated.enqueueScheduledCommunication(id);
      }
    }

    return {
      cancelled: true,
      batchId,
      cancelledAt: result.cancelledAt.toISOString(),
      cancelledChildCount: result.cancelledChildCount,
      scheduledCommunicationIds: result.scheduledCommunicationIds,
      alreadyCancelled: result.alreadyCancelled,
    };
  }
}
