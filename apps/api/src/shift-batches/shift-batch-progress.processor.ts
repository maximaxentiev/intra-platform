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
} from '../db/schema';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { buildBatchProgress70EmailContent } from './shift-batch-progress-email.template';
import {
  BATCH_PROGRESS_70_COMMUNICATION_TYPE,
  parseBatchProgress70IdempotencyKey,
} from './shift-batch-progress.types';
import {
  computeBatchProgressCounts,
  isBatchProgressEmailEligible,
} from './shift-batch-progress.util';

export class BatchProgress70CommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = BATCH_PROGRESS_70_COMMUNICATION_TYPE;

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

    const parsed = parseBatchProgress70IdempotencyKey(idempotencyKey);
    if (!parsed) return { kind: 'stale' };

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
    if (!batch) return { kind: 'stale' };
    if (batch.requestCompletedAt) {
      return {
        kind: 'skipped',
        code: 'batch_completed_superseded',
        reason: 'Batch request was completed; progress update no longer applies.',
      };
    }
    if (context.recipientEntityId && context.recipientEntityId !== batch.centreId) {
      return { kind: 'stale' };
    }

    const childRows = await db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.batchId, parsed.batchId));
    const progress = computeBatchProgressCounts(childRows);
    if (!isBatchProgressEmailEligible(progress)) {
      return {
        kind: 'skipped',
        code: 'batch_progress_no_longer_eligible',
        reason: 'Batch progress is no longer in the eligible range.',
      };
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

    const content = buildBatchProgress70EmailContent({
      centreName: batch.centreName,
      fulfilledCount: progress.fulfilledCount,
      activeTotal: progress.activeTotal,
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

export function registerBatchProgress70Processor(
  registry: { register: (processor: CommunicationProcessor) => void },
  config: ConfigService,
): void {
  registry.register(new BatchProgress70CommunicationProcessor(config));
}
