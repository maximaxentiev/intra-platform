import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import {
  scheduledCommunications,
  staffAccounts,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import {
  isStaffDocumentReminderType,
  STAFF_DOCUMENT_REMINDER_TYPES,
  type StaffDocumentType,
} from './staff-document.constants';
import { deriveExpiryDisplay } from './staff-document-dates.util';
import { isActiveReminderSubmission } from './staff-document-compliance.util';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import {
  buildDocumentExpiryIdempotencyKey,
  DOCUMENT_EXPIRY_COMMUNICATION_TYPE,
  DOCUMENT_EXPIRY_COMMUNICATION_TYPES,
} from './document-expiry-reminder.types';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

export type DocumentExpiryReminderContext = {
  staffId: string;
  documentSetId: string;
  documentType: StaffDocumentType;
  submissionId: string;
  expiryDate: string;
};

@Injectable()
export class DocumentExpiryReminderService {
  private readonly logger = new Logger(DocumentExpiryReminderService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
  ) {}

  isEligibleForScheduling(params: {
    documentType: StaffDocumentType;
    reviewStatus: string;
    expiryDate: string | null;
    set: { currentSubmissionId: string | null };
    submission: { id: string; supersededAt: string | Date | null };
    accountStatus: string | null;
    hasPortalAccount: boolean;
  }): boolean {
    if (!isStaffDocumentReminderType(params.documentType)) return false;
    if (!params.hasPortalAccount || params.accountStatus === 'disabled') return false;
    if (params.reviewStatus !== 'approved') return false;
    if (!params.expiryDate) return false;
    if (!isActiveReminderSubmission(params.set, params.submission)) return false;
    if (deriveExpiryDisplay(params.expiryDate) === 'expired') return false;
    return true;
  }

  async scheduleForApprovedSubmission(
    ctx: DocumentExpiryReminderContext,
    executor: DbLike,
    now: Date = new Date(),
  ): Promise<string[]> {
    if (!isStaffDocumentReminderType(ctx.documentType)) return [];

    const plans = planFutureDocumentExpiryReminders(ctx.expiryDate, now);
    const scheduledIds: string[] = [];

    for (const plan of plans) {
      const idempotencyKey = buildDocumentExpiryIdempotencyKey({
        submissionId: ctx.submissionId,
        offsetDays: plan.offsetDays,
      });

      const row = await this.automated.ensureScheduled(
        {
          idempotencyKey,
          communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[plan.offsetDays],
          entityType: 'staff_document',
          entityId: ctx.submissionId,
          recipientType: 'staff',
          recipientEntityId: ctx.staffId,
          scheduledFor: plan.scheduledFor,
        },
        executor,
      );
      scheduledIds.push(row.id);
    }

    return scheduledIds;
  }

  async cancelPendingForSubmission(submissionId: string, executor?: DbLike): Promise<number> {
    const db = executor ?? this.db;
    const rows = await db
      .update(scheduledCommunications)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledCommunications.entityType, 'staff_document'),
          eq(scheduledCommunications.entityId, submissionId),
          inArray(scheduledCommunications.communicationType, DOCUMENT_EXPIRY_COMMUNICATION_TYPES),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .returning({ id: scheduledCommunications.id });

    return rows.length;
  }

  async syncRemindersForSet(
    params: {
      staffId: string;
      documentSetId: string;
      documentType: StaffDocumentType;
      submission: {
        id: string;
        reviewStatus: string;
        expiryDate: string | null;
        supersededAt: Date | string | null;
      } | null;
      set: { currentSubmissionId: string | null };
      accountStatus: string | null;
      hasPortalAccount: boolean;
    },
    executor: DbLike,
    now: Date = new Date(),
  ): Promise<string[]> {
    if (!params.submission) {
      return [];
    }

    const eligible = this.isEligibleForScheduling({
      documentType: params.documentType,
      reviewStatus: params.submission.reviewStatus,
      expiryDate: params.submission.expiryDate,
      set: params.set,
      submission: params.submission,
      accountStatus: params.accountStatus,
      hasPortalAccount: params.hasPortalAccount,
    });

    if (!eligible) {
      await this.cancelPendingForSubmission(params.submission.id, executor);
      return [];
    }

    await this.cancelPendingForSubmission(params.submission.id, executor);
    return this.scheduleForApprovedSubmission(
      {
        staffId: params.staffId,
        documentSetId: params.documentSetId,
        documentType: params.documentType,
        submissionId: params.submission.id,
        expiryDate: params.submission.expiryDate!,
      },
      executor,
      now,
    );
  }

  async enqueueScheduledIds(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.automated.enqueueScheduledCommunication(id);
    }
  }

  async reconcileEligibleDocuments(
    batchSize = 200,
  ): Promise<{ ensured: number; cancelled: number; enqueued: number }> {
    const now = new Date();
    let ensured = 0;
    let cancelled = 0;
    let enqueued = 0;

    const sets = await this.db
      .select({
        setId: staffDocumentSets.id,
        staffId: staffDocumentSets.staffId,
        documentType: staffDocumentSets.documentType,
        currentSubmissionId: staffDocumentSets.currentSubmissionId,
        submissionId: staffDocumentSubmissions.id,
        reviewStatus: staffDocumentSubmissions.reviewStatus,
        expiryDate: staffDocumentSubmissions.expiryDate,
        supersededAt: staffDocumentSubmissions.supersededAt,
        accountStatus: staffAccounts.status,
        accountId: staffAccounts.id,
      })
      .from(staffDocumentSets)
      .innerJoin(
        staffDocumentSubmissions,
        eq(staffDocumentSets.currentSubmissionId, staffDocumentSubmissions.id),
      )
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staffDocumentSets.staffId))
      .where(
        and(
          inArray(staffDocumentSets.documentType, [...STAFF_DOCUMENT_REMINDER_TYPES]),
          isNotNull(staffDocumentSubmissions.expiryDate),
          isNull(staffDocumentSubmissions.supersededAt),
        ),
      )
      .limit(batchSize);

    for (const row of sets) {
      const eligible = this.isEligibleForScheduling({
        documentType: row.documentType,
        reviewStatus: row.reviewStatus,
        expiryDate: row.expiryDate,
        set: { currentSubmissionId: row.currentSubmissionId },
        submission: { id: row.submissionId, supersededAt: row.supersededAt },
        accountStatus: row.accountStatus,
        hasPortalAccount: Boolean(row.accountId),
      });

      if (!eligible) {
        const count = await this.cancelPendingForSubmission(row.submissionId);
        cancelled += count;
        continue;
      }

      const plans = planFutureDocumentExpiryReminders(row.expiryDate!, now);
      for (const plan of plans) {
        const idempotencyKey = buildDocumentExpiryIdempotencyKey({
          submissionId: row.submissionId,
          offsetDays: plan.offsetDays,
        });

        const scheduled = await this.automated.ensureScheduled({
          idempotencyKey,
          communicationType: DOCUMENT_EXPIRY_COMMUNICATION_TYPE[plan.offsetDays],
          entityType: 'staff_document',
          entityId: row.submissionId,
          recipientType: 'staff',
          recipientEntityId: row.staffId,
          scheduledFor: plan.scheduledFor,
        });

        if (scheduled.status === 'scheduled') {
          ensured += 1;
          await this.automated.enqueueScheduledCommunication(scheduled.id);
          enqueued += 1;
        }
      }
    }

    const orphanedCancelled = await this.cancelOrphanedPendingReminders(batchSize);
    cancelled += orphanedCancelled;

    if (ensured > 0 || cancelled > 0) {
      this.logger.log(
        `Document expiry reconciliation ensured=${ensured} cancelled=${cancelled} enqueued=${enqueued}`,
      );
    }

    return { ensured, cancelled, enqueued };
  }

  private async cancelOrphanedPendingReminders(limit = 200): Promise<number> {
    const pending = await this.db
      .select({
        id: scheduledCommunications.id,
        entityId: scheduledCommunications.entityId,
        idempotencyKey: scheduledCommunications.idempotencyKey,
      })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityType, 'staff_document'),
          inArray(scheduledCommunications.communicationType, DOCUMENT_EXPIRY_COMMUNICATION_TYPES),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .limit(limit);

    let cancelled = 0;
    for (const row of pending) {
      const submissionRows = await this.db
        .select({
          submissionId: staffDocumentSubmissions.id,
          reviewStatus: staffDocumentSubmissions.reviewStatus,
          expiryDate: staffDocumentSubmissions.expiryDate,
          supersededAt: staffDocumentSubmissions.supersededAt,
          documentType: staffDocumentSets.documentType,
          currentSubmissionId: staffDocumentSets.currentSubmissionId,
          staffId: staffDocumentSets.staffId,
          accountStatus: staffAccounts.status,
          accountId: staffAccounts.id,
        })
        .from(staffDocumentSubmissions)
        .innerJoin(
          staffDocumentSets,
          eq(staffDocumentSubmissions.documentSetId, staffDocumentSets.id),
        )
        .leftJoin(staffAccounts, eq(staffAccounts.staffId, staffDocumentSets.staffId))
        .where(eq(staffDocumentSubmissions.id, row.entityId))
        .limit(1);

      const context = submissionRows[0];
      if (!context) {
        await this.automated.cancelByEntity('staff_document', row.entityId);
        cancelled += 1;
        continue;
      }

      const eligible = this.isEligibleForScheduling({
        documentType: context.documentType,
        reviewStatus: context.reviewStatus,
        expiryDate: context.expiryDate,
        set: { currentSubmissionId: context.currentSubmissionId },
        submission: { id: context.submissionId, supersededAt: context.supersededAt },
        accountStatus: context.accountStatus,
        hasPortalAccount: Boolean(context.accountId),
      });

      if (!eligible) {
        await this.automated.cancelByEntity('staff_document', row.entityId);
        cancelled += 1;
        continue;
      }

      const offsetMatch = /^staff-document:[^:]+:expiry:(30|14|7|3|1)d$/.exec(row.idempotencyKey);
      if (context.expiryDate && offsetMatch) {
        const offsetDays = Number(offsetMatch[1]) as 30 | 14 | 7 | 3 | 1;
        const plans = planFutureDocumentExpiryReminders(context.expiryDate, new Date());
        if (!plans.some((plan) => plan.offsetDays === offsetDays)) {
          await this.automated.cancelByEntity('staff_document', row.entityId);
          cancelled += 1;
        }
      }
    }

    return cancelled;
  }
}
