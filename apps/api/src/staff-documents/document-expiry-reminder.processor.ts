import type { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import type { PlatformUrlEnv } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import {
  scheduledCommunications,
  staff,
  staffAccounts,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import type { CommunicationProcessor } from '../automated-communications/communication-processor.registry';
import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from '../automated-communications/automated-communications.types';
import type { CommunicationProcessorContext } from '../automated-communications/communication-processor.registry';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { normalizeStaffEmail } from '../staff-portal/portal-account-status.util';
import { isStaffDocumentReminderType } from './staff-document.constants';
import { deriveExpiryDisplay } from './staff-document-dates.util';
import { isActiveReminderSubmission } from './staff-document-compliance.util';
import { buildDocumentExpiryCarerEmailContent } from './document-expiry-carer-email.template';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import {
  DOCUMENT_EXPIRY_COMMUNICATION_TYPE,
  parseDocumentExpiryIdempotencyKey,
  type DocumentExpiryReminderOffsetDays,
} from './document-expiry-reminder.types';

export class DocumentExpiryCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType;

  constructor(
    private readonly offsetDays: DocumentExpiryReminderOffsetDays,
    private readonly config: ConfigService,
  ) {
    this.communicationType = DOCUMENT_EXPIRY_COMMUNICATION_TYPE[offsetDays];
  }

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
    if (!idempotencyKey) {
      return { kind: 'stale' };
    }

    const parsed = parseDocumentExpiryIdempotencyKey(idempotencyKey);
    if (!parsed || parsed.offsetDays !== this.offsetDays) {
      return { kind: 'stale' };
    }

    const rows = await db
      .select({
        submissionId: staffDocumentSubmissions.id,
        reviewStatus: staffDocumentSubmissions.reviewStatus,
        expiryDate: staffDocumentSubmissions.expiryDate,
        supersededAt: staffDocumentSubmissions.supersededAt,
        documentType: staffDocumentSets.documentType,
        remindersEnabled: staffDocumentSets.remindersEnabled,
        currentSubmissionId: staffDocumentSets.currentSubmissionId,
        staffId: staffDocumentSets.staffId,
        staffEmail: staff.email,
        staffLegalName: staff.legalName,
        accountEmail: staffAccounts.email,
        accountStatus: staffAccounts.status,
      })
      .from(staffDocumentSubmissions)
      .innerJoin(staffDocumentSets, eq(staffDocumentSubmissions.documentSetId, staffDocumentSets.id))
      .innerJoin(staff, eq(staff.id, staffDocumentSets.staffId))
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(staffDocumentSubmissions.id, parsed.submissionId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { kind: 'stale' };
    }

    if (!isStaffDocumentReminderType(row.documentType)) {
      return { kind: 'stale' };
    }

    if (!row.remindersEnabled) {
      return { kind: 'stale' };
    }

    if (row.accountStatus === 'disabled') {
      return { kind: 'stale' };
    }

    if (!row.accountEmail && !row.accountStatus) {
      return { kind: 'stale' };
    }

    if (row.reviewStatus !== 'approved') {
      return { kind: 'stale' };
    }

    if (
      !isActiveReminderSubmission(
        { currentSubmissionId: row.currentSubmissionId },
        { id: row.submissionId, supersededAt: row.supersededAt },
      )
    ) {
      return { kind: 'stale' };
    }

    if (!row.expiryDate) {
      return { kind: 'stale' };
    }

    if (deriveExpiryDisplay(row.expiryDate) === 'expired') {
      return { kind: 'stale' };
    }

    const now = new Date();
    const expectedPlans = planFutureDocumentExpiryReminders(row.expiryDate, now);
    if (!expectedPlans.some((plan) => plan.offsetDays === parsed.offsetDays)) {
      return { kind: 'stale' };
    }

    const recipientRaw = row.accountEmail ?? row.staffEmail;
    const normalizedStaffEmail = normalizeStaffEmail(row.staffEmail);
    const recipientCandidate = recipientRaw?.trim()
      ? normalizeNotificationEmail(recipientRaw)
      : normalizedStaffEmail;

    if (!recipientCandidate) {
      return {
        kind: 'skipped',
        code: 'no_staff_email',
        reason: 'Staff has no email address.',
      };
    }

    if (!isValidNotificationEmail(recipientCandidate)) {
      return {
        kind: 'skipped',
        code: 'invalid_staff_email',
        reason: 'Staff email is invalid.',
      };
    }

    const content = buildDocumentExpiryCarerEmailContent({
      carerName: row.staffLegalName,
      documentType: row.documentType as 'vulnerable_sector_check' | 'first_aid_cpr',
      expiryDate: row.expiryDate,
      offsetDays: parsed.offsetDays,
      platformEnv: this.platformEnv(),
    });

    return {
      kind: 'valid',
      recipientEmail: recipientCandidate,
      subject: content.subject,
      html: content.html,
      text: content.text,
    };
  }

  private platformEnv(): PlatformUrlEnv {
    return {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };
  }
}

export function registerDocumentExpiryProcessors(
  registry: { register(processor: CommunicationProcessor): void },
  config: ConfigService,
): void {
  for (const offsetDays of [30, 14, 7, 3, 1] as const) {
    registry.register(new DocumentExpiryCommunicationProcessor(offsetDays, config));
  }
}
