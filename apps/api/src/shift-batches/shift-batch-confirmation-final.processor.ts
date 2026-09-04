import type { ConfigService } from '@nestjs/config';
import { aliasedTable, asc, eq } from 'drizzle-orm';
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
} from '../db/schema';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { ensureFreshStaffDocumentShareUrlForCentreEmail } from '../staff-documents/staff-document-share-email.util';
import {
  buildBatchConfirmationFinalEmailContent,
  buildBatchConfirmationFinalEmailDefaultBody,
  defaultBatchConfirmationFinalEmailSubject,
  resolveBatchFinalCarerLegalName,
} from './shift-batch-confirmation-final-email.template';
import {
  BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE,
  parseBatchConfirmationFinalIdempotencyKey,
} from './shift-batch-completion.types';
import { isActiveFulfilledShift } from './shift-batch-completion.util';
import { computeBatchProgressCounts } from './shift-batch-progress.util';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { loadCentreEmailCustomContentFromAudit } from '../email/centre-email-audit.util';
import { normalizeCentreEmailCustomContent } from '../email/centre-email-custom-content.util';

const assignee = aliasedTable(staff, 'assignee');

export class BatchConfirmationFinalCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = BATCH_CONFIRMATION_FINAL_COMMUNICATION_TYPE;

  constructor(private readonly config: ConfigService) {}

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

    const parsed = parseBatchConfirmationFinalIdempotencyKey(idempotencyKey);
    if (!parsed) return { kind: 'stale' };

    const batchRows = await db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        cancelledAt: shiftBatches.cancelledAt,
        centreName: centres.name,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, parsed.batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) return { kind: 'stale' };
    if (batch.cancelledAt) return { kind: 'stale' };
    if (!batch.requestCompletedAt) return { kind: 'stale' };
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
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        shiftConfirmationNotes: shifts.shiftConfirmationNotes,
        legalName: assignee.legalName,
        legalFirstName: assignee.legalFirstName,
        legalLastName: assignee.legalLastName,
        displayName: assignee.displayName,
        useDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .where(eq(shifts.batchId, parsed.batchId))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));

    const active = childRows.filter((row) => row.status !== 'cancelled');
    const progress = computeBatchProgressCounts(childRows);
    if (progress.activeTotal === 0 || progress.fulfilledCount !== progress.activeTotal) {
      return {
        kind: 'skipped',
        code: 'batch_final_no_longer_valid',
        reason: 'Batch assignments changed after completion.',
      };
    }

    const shareCache = new Map<string, string>();
    const assignments = [];
    for (const row of active) {
      if (!row.assignedStaffId || !isActiveFulfilledShift(row.status)) {
        return {
          kind: 'skipped',
          code: 'batch_final_missing_assignment',
          reason: 'Batch assignments changed after completion.',
        };
      }

      let shareUrl = shareCache.get(row.assignedStaffId);
      if (!shareUrl) {
        shareUrl =
          (await ensureFreshStaffDocumentShareUrlForCentreEmail(
            db,
            this.config,
            row.assignedStaffId,
          )) ?? '';
        if (!shareUrl) {
          return {
            kind: 'permanent_failure',
            code: 'document_share_unavailable',
            reason: 'Carer document share is unavailable for final confirmation.',
          };
        }
        shareCache.set(row.assignedStaffId, shareUrl);
      }

      assignments.push({
        assignedStaffId: row.assignedStaffId,
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
        carerLegalName: resolveBatchFinalCarerLegalName({
          legalName: row.legalName,
          legalFirstName: row.legalFirstName,
          legalLastName: row.legalLastName,
          displayName: row.displayName,
          useDisplayName: row.useDisplayName,
        }),
        shiftConfirmationNotes: row.shiftConfirmationNotes ?? '',
        documentShareUrl: shareUrl,
      });
    }

    const customContent = await loadCentreEmailCustomContentFromAudit(
      db,
      context.scheduledCommunicationId,
      PLATFORM_AUDIT_ACTIONS.batchFinalConfirmationScheduled,
    );
    const defaults = {
      subject: defaultBatchConfirmationFinalEmailSubject(batch.centreName),
      body: buildBatchConfirmationFinalEmailDefaultBody({
        centreName: batch.centreName,
        activeShiftCount: active.length,
        assignments,
      }),
    };
    const resolved = normalizeCentreEmailCustomContent(
      customContent
        ? {
            subject: customContent.customSubject,
            body: customContent.customBody ?? customContent.customMessage,
          }
        : undefined,
      defaults,
    );

    const content = buildBatchConfirmationFinalEmailContent({
      centreName: batch.centreName,
      activeShiftCount: active.length,
      assignments,
      customSubject: resolved.subject,
      customBody: resolved.body,
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

export function registerBatchConfirmationFinalProcessor(
  registry: { register: (processor: CommunicationProcessor) => void },
  config: ConfigService,
): void {
  registry.register(new BatchConfirmationFinalCommunicationProcessor(config));
}
