import type { ConfigService } from '@nestjs/config';
import { asc, eq } from 'drizzle-orm';
import type { CommunicationProcessor } from '../automated-communications/communication-processor.registry';
import type { CommunicationProcessorContext } from '../automated-communications/communication-processor.registry';
import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from '../automated-communications/automated-communications.types';
import type { Database } from '../db/drizzle.module';
import {
  centreContacts,
  centres,
  scheduledCommunications,
  shiftBatches,
  shifts,
  staff,
  staffAccounts,
} from '../db/schema';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { normalizeStaffEmail } from '../staff-portal/portal-account-status.util';
import {
  buildBatchCancellationCarerEmailContent,
  buildBatchCancellationCentreEmailContent,
} from './shift-batch-cancellation-email.template';
import {
  BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE,
  BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE,
  parseBatchCancellationCarerIdempotencyKey,
  parseBatchCancellationCentreIdempotencyKey,
} from './shift-batch-cancellation.types';

export class BatchCancellationCentreCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = BATCH_CANCELLATION_CENTRE_COMMUNICATION_TYPE;

  constructor(private readonly _config: ConfigService) {}

  async evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    const commRows = await db
      .select({ idempotencyKey: scheduledCommunications.idempotencyKey })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, context.scheduledCommunicationId))
      .limit(1);

    const idempotencyKey = commRows[0]?.idempotencyKey;
    if (!idempotencyKey) return { kind: 'stale' };

    const parsed = parseBatchCancellationCentreIdempotencyKey(idempotencyKey);
    if (!parsed) return { kind: 'stale' };

    const batchRows = await db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        cancelledAt: shiftBatches.cancelledAt,
        cancellationReason: shiftBatches.cancellationReason,
        centreName: centres.name,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, parsed.batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch?.cancelledAt) return { kind: 'stale' };
    if (String(batch.cancelledAt.getTime()) !== parsed.cancellationVersion) return { kind: 'stale' };
    if (context.recipientEntityId && context.recipientEntityId !== batch.centreId) {
      return { kind: 'stale' };
    }

    const primaryRows = await db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, batch.centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const rawEmail = primaryRows[0]?.email;
    const recipientEmail = rawEmail ? normalizeNotificationEmail(rawEmail) : null;
    if (!recipientEmail || !isValidNotificationEmail(recipientEmail)) {
      return {
        kind: 'permanent_failure',
        code: 'no_centre_primary_contact',
        reason: 'Centre primary contact email is unavailable.',
      };
    }

    const childRows = await db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        updatedAt: shifts.updatedAt,
      })
      .from(shifts)
      .where(eq(shifts.batchId, parsed.batchId))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));

    const cancelledInCycle = childRows.filter(
      (row) =>
        row.status === 'cancelled' &&
        row.updatedAt &&
        String(row.updatedAt.getTime()) === parsed.cancellationVersion,
    );

    if (!cancelledInCycle.length) {
      return {
        kind: 'skipped',
        code: 'batch_cancellation_no_shifts',
        reason: 'No cancelled shifts found for this batch cancellation.',
      };
    }

    const content = buildBatchCancellationCentreEmailContent({
      centreName: batch.centreName,
      shifts: cancelledInCycle.map((row) => ({
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
      })),
      cancellationReason: batch.cancellationReason,
    });

    return {
      kind: 'valid',
      recipientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
    };
  }
}

export class BatchCancellationCarerCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = BATCH_CANCELLATION_CARER_COMMUNICATION_TYPE;

  constructor(private readonly _config: ConfigService) {}

  async evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    const commRows = await db
      .select({ idempotencyKey: scheduledCommunications.idempotencyKey })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, context.scheduledCommunicationId))
      .limit(1);

    const idempotencyKey = commRows[0]?.idempotencyKey;
    if (!idempotencyKey) return { kind: 'stale' };

    const parsed = parseBatchCancellationCarerIdempotencyKey(idempotencyKey);
    if (!parsed) return { kind: 'stale' };

    const batchRows = await db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        cancelledAt: shiftBatches.cancelledAt,
        centreName: centres.name,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, parsed.batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch?.cancelledAt) return { kind: 'stale' };
    if (String(batch.cancelledAt.getTime()) !== parsed.cancellationVersion) return { kind: 'stale' };
    if (context.recipientEntityId && context.recipientEntityId !== parsed.staffId) {
      return { kind: 'stale' };
    }

    const staffRows = await db
      .select({
        staffEmail: staff.email,
        accountEmail: staffAccounts.email,
      })
      .from(staff)
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(staff.id, parsed.staffId))
      .limit(1);

    const staffRow = staffRows[0];
    if (!staffRow) return { kind: 'stale' };

    const recipientRaw = staffRow.accountEmail ?? staffRow.staffEmail;
    const normalizedStaffEmail = normalizeStaffEmail(staffRow.staffEmail ?? '');
    const recipientCandidate = recipientRaw?.trim()
      ? normalizeNotificationEmail(recipientRaw)
      : normalizedStaffEmail;

    if (!recipientCandidate) {
      return {
        kind: 'skipped',
        code: 'no_carer_email',
        reason: 'Assigned carer has no email address.',
      };
    }
    if (!isValidNotificationEmail(recipientCandidate)) {
      return {
        kind: 'skipped',
        code: 'invalid_carer_email',
        reason: 'Assigned carer email is invalid.',
      };
    }

    const childRows = await db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        updatedAt: shifts.updatedAt,
      })
      .from(shifts)
      .where(eq(shifts.batchId, parsed.batchId))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));

    const carerShifts = childRows.filter(
      (row) =>
        row.status === 'cancelled' &&
        row.assignedStaffId === parsed.staffId &&
        row.updatedAt &&
        String(row.updatedAt.getTime()) === parsed.cancellationVersion,
    );

    if (!carerShifts.length) {
      return {
        kind: 'skipped',
        code: 'batch_cancellation_no_carer_shifts',
        reason: 'No cancelled shifts found for this carer.',
      };
    }

    const content = buildBatchCancellationCarerEmailContent({
      centreName: batch.centreName,
      shifts: carerShifts.map((row) => ({
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
      })),
    });

    return {
      kind: 'valid',
      recipientEmail: recipientCandidate,
      subject: content.subject,
      html: content.html,
      text: content.text,
    };
  }
}

export function registerBatchCancellationProcessors(
  registry: { register(processor: CommunicationProcessor): void },
  config: ConfigService,
): void {
  registry.register(new BatchCancellationCentreCommunicationProcessor(config));
  registry.register(new BatchCancellationCarerCommunicationProcessor(config));
}
