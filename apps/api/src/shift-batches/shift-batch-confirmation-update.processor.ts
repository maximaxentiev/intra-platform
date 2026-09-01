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
  platformAuditEvents,
  scheduledCommunications,
  shiftBatches,
  shifts,
  staff,
} from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { buildActiveStaffDocumentShareUrlForEmail } from '../staff-documents/staff-document-share-email.util';
import {
  resolveBatchFinalCarerLegalName,
} from './shift-batch-confirmation-final-email.template';
import { buildBatchConfirmationUpdateEmailContent } from './shift-batch-confirmation-update-email.template';
import {
  BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE,
  parseBatchConfirmationFinalIdempotencyKey,
} from './shift-batch-completion.types';
import { isActiveFulfilledShift } from './shift-batch-completion.util';
import { computeBatchProgressCounts } from './shift-batch-progress.util';

const assignee = aliasedTable(staff, 'assignee');

export class BatchConfirmationUpdateCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = BATCH_CONFIRMATION_UPDATE_COMMUNICATION_TYPE;

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
    if (!parsed || parsed.revision < 2) return { kind: 'stale' };

    const batchRows = await db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        centreName: centres.name,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, parsed.batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch?.requestCompletedAt) return { kind: 'stale' };
    if (context.recipientEntityId && context.recipientEntityId !== batch.centreId) {
      return { kind: 'stale' };
    }

    const highlightedChanges = await this.loadHighlightedChanges(
      db,
      context.scheduledCommunicationId,
    );

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
        code: 'batch_update_no_longer_valid',
        reason: 'Batch assignments changed before update confirmation could be sent.',
      };
    }

    const shareCache = new Map<string, string>();
    const assignments = [];
    for (const row of active) {
      if (!row.assignedStaffId || !isActiveFulfilledShift(row.status)) {
        return {
          kind: 'skipped',
          code: 'batch_update_missing_assignment',
          reason: 'Batch assignments changed before update confirmation could be sent.',
        };
      }

      let shareUrl = shareCache.get(row.assignedStaffId);
      if (!shareUrl) {
        shareUrl =
          (await buildActiveStaffDocumentShareUrlForEmail(db, this.config, row.assignedStaffId)) ??
          '';
        if (!shareUrl) {
          return {
            kind: 'permanent_failure',
            code: 'document_share_unavailable',
            reason: 'Carer document share is unavailable for update confirmation.',
          };
        }
        shareCache.set(row.assignedStaffId, shareUrl);
      }

      assignments.push({
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

    const content = buildBatchConfirmationUpdateEmailContent({
      centreName: batch.centreName,
      highlightedChanges,
      assignments,
    });

    return {
      kind: 'valid',
      recipientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
    };
  }

  private async loadHighlightedChanges(db: Database, scheduledCommunicationId: string) {
    const rows = await db
      .select({ metadata: platformAuditEvents.metadata })
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.action, PLATFORM_AUDIT_ACTIONS.batchUpdateConfirmationScheduled))
      .orderBy(asc(platformAuditEvents.occurredAt));

    for (const row of rows) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      if (metadata.scheduledCommunicationId === scheduledCommunicationId) {
        const highlighted = metadata.highlightedChanges;
        if (Array.isArray(highlighted)) {
          return highlighted.filter((item): item is string => typeof item === 'string');
        }
      }
    }

    return [];
  }
}

export function registerBatchConfirmationUpdateProcessor(
  registry: { register: (processor: CommunicationProcessor) => void },
  config: ConfigService,
): void {
  registry.register(new BatchConfirmationUpdateCommunicationProcessor(config));
}
