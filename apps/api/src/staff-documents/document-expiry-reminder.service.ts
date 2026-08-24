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
import {
  planFutureDocumentExpiryReminders,
  type FutureDocumentExpiryReminderPlan,
} from './document-expiry-reminder-scheduling.util';
import {
  ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES,
  buildDocumentExpiryIdempotencyKeyDays,
  buildDocumentExpiryIdempotencyKeyMonths,
  buildLegacyFirstAidDayIdempotencyKeys,
  DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE,
  DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE,
  FIRST_AID_DOCUMENT_EXPIRY_REMINDER_OFFSETS_MONTHS,
  parseDocumentExpiryIdempotencyKey,
  VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS,
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

  private async getSentReminderIdempotencyKeys(submissionId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ idempotencyKey: scheduledCommunications.idempotencyKey })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityId, submissionId),
          eq(scheduledCommunications.status, 'sent'),
          inArray(scheduledCommunications.communicationType, [...ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES]),
        ),
      );
    return new Set(rows.map((row) => row.idempotencyKey));
  }

  private planIdempotencyKey(submissionId: string, plan: FutureDocumentExpiryReminderPlan): string {
    if (plan.unit === 'days') {
      return buildDocumentExpiryIdempotencyKeyDays({
        submissionId,
        offsetDays: plan.offsetDays,
      });
    }
    return buildDocumentExpiryIdempotencyKeyMonths({
      submissionId,
      offsetMonths: plan.offsetMonths,
    });
  }

  private communicationTypeFromPlan(plan: FutureDocumentExpiryReminderPlan) {
    if (plan.unit === 'days') {
      return DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[plan.offsetDays];
    }
    return DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE[plan.offsetMonths];
  }

  private legacyFirstAid30dSent(sentKeys: Set<string>, submissionId: string): boolean {
    return sentKeys.has(
      buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays: 30 }),
    );
  }

  async scheduleForApprovedSubmission(
    ctx: DocumentExpiryReminderContext,
    executor: DbLike,
    now: Date = new Date(),
    sentKeys?: Set<string>,
  ): Promise<string[]> {
    if (!isStaffDocumentReminderType(ctx.documentType)) return [];

    const resolvedSentKeys =
      sentKeys ?? (await this.getSentReminderIdempotencyKeys(ctx.submissionId));
    const plans = planFutureDocumentExpiryReminders(ctx.documentType, ctx.expiryDate, now, {
      legacyFirstAid30dSent:
        ctx.documentType === 'first_aid_cpr' &&
        this.legacyFirstAid30dSent(resolvedSentKeys, ctx.submissionId),
    });
    const scheduledIds: string[] = [];

    for (const plan of plans) {
      const idempotencyKey = this.planIdempotencyKey(ctx.submissionId, plan);

      const row = await this.automated.ensureScheduled(
        {
          idempotencyKey,
          communicationType: this.communicationTypeFromPlan(plan),
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
          inArray(scheduledCommunications.communicationType, [...ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES]),
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

  private async cancelObsoleteReminderKeys(
    documentType: StaffDocumentType,
    submissionId: string,
    plans: FutureDocumentExpiryReminderPlan[],
  ): Promise<number> {
    let cancelled = 0;

    if (documentType === 'first_aid_cpr') {
      cancelled += await this.automated.cancelByIdempotencyKeys(
        buildLegacyFirstAidDayIdempotencyKeys(submissionId),
      );

      const activeMonthOffsets = new Set(
        plans.filter((plan) => plan.unit === 'months').map((plan) => plan.offsetMonths),
      );
      const obsoleteMonthKeys = FIRST_AID_DOCUMENT_EXPIRY_REMINDER_OFFSETS_MONTHS.filter(
        (offsetMonths) => !activeMonthOffsets.has(offsetMonths),
      ).map((offsetMonths) =>
        buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths }),
      );
      if (obsoleteMonthKeys.length > 0) {
        cancelled += await this.automated.cancelByIdempotencyKeys(obsoleteMonthKeys);
      }
      return cancelled;
    }

    if (documentType === 'vulnerable_sector_check') {
      const activeDayOffsets = new Set(
        plans.filter((plan) => plan.unit === 'days').map((plan) => plan.offsetDays),
      );
      const obsoleteDayKeys = VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS.filter(
        (offsetDays) => !activeDayOffsets.has(offsetDays),
      ).map((offsetDays) => buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays }));
      if (obsoleteDayKeys.length > 0) {
        cancelled += await this.automated.cancelByIdempotencyKeys(obsoleteDayKeys);
      }

      const obsoleteMonthKeys = FIRST_AID_DOCUMENT_EXPIRY_REMINDER_OFFSETS_MONTHS.map(
        (offsetMonths) => buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths }),
      );
      cancelled += await this.automated.cancelByIdempotencyKeys(obsoleteMonthKeys);
    }

    return cancelled;
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

      const sentKeys = await this.getSentReminderIdempotencyKeys(row.submissionId);
      const plans = planFutureDocumentExpiryReminders(row.documentType, row.expiryDate!, now, {
        legacyFirstAid30dSent:
          row.documentType === 'first_aid_cpr' &&
          this.legacyFirstAid30dSent(sentKeys, row.submissionId),
      });

      cancelled += await this.cancelObsoleteReminderKeys(
        row.documentType,
        row.submissionId,
        plans,
      );

      for (const plan of plans) {
        const idempotencyKey = this.planIdempotencyKey(row.submissionId, plan);

        const scheduled = await this.automated.ensureScheduled({
          idempotencyKey,
          communicationType: this.communicationTypeFromPlan(plan),
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
          inArray(scheduledCommunications.communicationType, [...ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES]),
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
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
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
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
        continue;
      }

      const parsed = parseDocumentExpiryIdempotencyKey(row.idempotencyKey);
      if (!context.expiryDate || !parsed) {
        continue;
      }

      if (context.documentType === 'first_aid_cpr' && parsed.unit === 'days') {
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
        continue;
      }

      if (context.documentType === 'vulnerable_sector_check' && parsed.unit === 'months') {
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
        continue;
      }

      const sentKeys = await this.getSentReminderIdempotencyKeys(context.submissionId);
      const plans = planFutureDocumentExpiryReminders(
        context.documentType,
        context.expiryDate,
        new Date(),
        {
          legacyFirstAid30dSent:
            context.documentType === 'first_aid_cpr' &&
            this.legacyFirstAid30dSent(sentKeys, context.submissionId),
        },
      );

      const stillActive =
        parsed.unit === 'days'
          ? plans.some((plan) => plan.unit === 'days' && plan.offsetDays === parsed.offsetDays)
          : plans.some(
              (plan) => plan.unit === 'months' && plan.offsetMonths === parsed.offsetMonths,
            );

      if (!stillActive) {
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
      }
    }

    return cancelled;
  }
}
