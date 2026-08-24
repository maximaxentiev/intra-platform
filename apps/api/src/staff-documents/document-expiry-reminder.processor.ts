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
import {
  FIRST_AID_REMINDER_OFFSETS_MONTHS,
  VSC_REMINDER_OFFSETS_DAYS,
} from './staff-document.constants';
import { deriveExpiryDisplay } from './staff-document-dates.util';
import { isActiveReminderSubmission } from './staff-document-compliance.util';
import { buildDocumentExpiryCarerEmailContent } from './document-expiry-carer-email.template';
import {
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';
import {
  DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE,
  DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE,
  parseDocumentExpiryIdempotencyKey,
  type DocumentExpiryReminderOffsetDays,
  type DocumentExpiryReminderOffsetMonths,
} from './document-expiry-reminder.types';

abstract class DocumentExpiryCommunicationProcessorBase implements CommunicationProcessor {
  abstract readonly communicationType: CommunicationType;

  constructor(protected readonly config: ConfigService) {}

  async evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    const commRows = await db
      .select({
        idempotencyKey: scheduledCommunications.idempotencyKey,
        scheduledFor: scheduledCommunications.scheduledFor,
      })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, context.scheduledCommunicationId))
      .limit(1);

    const idempotencyKey = commRows[0]?.idempotencyKey;
    if (!idempotencyKey) {
      return { kind: 'stale' };
    }

    const parsed = parseDocumentExpiryIdempotencyKey(idempotencyKey);
    if (!parsed || !this.matchesParsedKey(parsed)) {
      return { kind: 'stale' };
    }

    const rows = await db
      .select({
        submissionId: staffDocumentSubmissions.id,
        reviewStatus: staffDocumentSubmissions.reviewStatus,
        expiryDate: staffDocumentSubmissions.expiryDate,
        supersededAt: staffDocumentSubmissions.supersededAt,
        documentType: staffDocumentSets.documentType,
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

    if (row.documentType !== this.expectedDocumentType()) {
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

    const commRow = commRows[0];
    if (!commRow) {
      return { kind: 'stale' };
    }

    const now = new Date();
    const expectedInstant = this.expectedInstant(row.expiryDate, parsed);
    if (Math.abs(commRow.scheduledFor.getTime() - expectedInstant.getTime()) > 1000) {
      return { kind: 'stale' };
    }

    if (expectedInstant.getTime() > now.getTime() + 1000) {
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
      documentType: this.expectedDocumentType(),
      expiryDate: row.expiryDate,
      timing: this.timingFromParsed(parsed),
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

  protected abstract matchesParsedKey(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): boolean;

  protected abstract expectedDocumentType(): 'vulnerable_sector_check' | 'first_aid_cpr';

  protected abstract expectedInstant(
    expiryDate: string,
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): Date;

  protected abstract timingFromParsed(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ):
    | { unit: 'days'; offsetDays: DocumentExpiryReminderOffsetDays }
    | { unit: 'months'; offsetMonths: DocumentExpiryReminderOffsetMonths };

  private platformEnv(): PlatformUrlEnv {
    return {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };
  }
}

class DocumentExpiryDayCommunicationProcessor extends DocumentExpiryCommunicationProcessorBase {
  readonly communicationType: CommunicationType;

  constructor(
    private readonly offsetDays: DocumentExpiryReminderOffsetDays,
    config: ConfigService,
  ) {
    super(config);
    this.communicationType = DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[offsetDays];
  }

  protected matchesParsedKey(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): boolean {
    return parsed.unit === 'days' && parsed.offsetDays === this.offsetDays;
  }

  protected expectedDocumentType(): 'vulnerable_sector_check' {
    return 'vulnerable_sector_check';
  }

  protected expectedInstant(
    expiryDate: string,
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): Date {
    if (parsed.unit !== 'days') {
      throw new Error('Expected day-based reminder key.');
    }
    return torontoDocumentReminderInstant(expiryDate, parsed.offsetDays);
  }

  protected timingFromParsed(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ) {
    if (parsed.unit !== 'days') {
      throw new Error('Expected day-based reminder key.');
    }
    return { unit: 'days' as const, offsetDays: parsed.offsetDays };
  }
}

class DocumentExpiryMonthCommunicationProcessor extends DocumentExpiryCommunicationProcessorBase {
  readonly communicationType: CommunicationType;

  constructor(
    private readonly offsetMonths: DocumentExpiryReminderOffsetMonths,
    config: ConfigService,
  ) {
    super(config);
    this.communicationType = DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE[offsetMonths];
  }

  protected matchesParsedKey(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): boolean {
    return parsed.unit === 'months' && parsed.offsetMonths === this.offsetMonths;
  }

  protected expectedDocumentType(): 'first_aid_cpr' {
    return 'first_aid_cpr';
  }

  protected expectedInstant(
    expiryDate: string,
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ): Date {
    if (parsed.unit !== 'months') {
      throw new Error('Expected month-based reminder key.');
    }
    return torontoDocumentReminderInstantMonths(expiryDate, parsed.offsetMonths);
  }

  protected timingFromParsed(
    parsed: NonNullable<ReturnType<typeof parseDocumentExpiryIdempotencyKey>>,
  ) {
    if (parsed.unit !== 'months') {
      throw new Error('Expected month-based reminder key.');
    }
    return { unit: 'months' as const, offsetMonths: parsed.offsetMonths };
  }
}

export function registerDocumentExpiryProcessors(
  registry: { register(processor: CommunicationProcessor): void },
  config: ConfigService,
): void {
  for (const offsetDays of VSC_REMINDER_OFFSETS_DAYS) {
    registry.register(new DocumentExpiryDayCommunicationProcessor(offsetDays, config));
  }
  for (const offsetMonths of FIRST_AID_REMINDER_OFFSETS_MONTHS) {
    registry.register(new DocumentExpiryMonthCommunicationProcessor(offsetMonths, config));
  }
}

export {
  DocumentExpiryDayCommunicationProcessor,
  DocumentExpiryMonthCommunicationProcessor,
};
