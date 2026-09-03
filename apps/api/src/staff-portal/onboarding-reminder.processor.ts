import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { parseCarerPortalEnabled } from '../config/carer-portal.config';
import type { PlatformUrlEnv } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import { scheduledCommunications, staff, staffAccounts } from '../db/schema';
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
import { normalizeStaffEmail } from './portal-account-status.util';
import { buildOnboardingReminderEmailContent } from './onboarding-reminder-email.template';
import {
  ONBOARDING_REMINDER_COMMUNICATION_TYPE,
  parseOnboardingReminderIdempotencyKey,
  type OnboardingReminderOffsetDays,
} from './onboarding-reminder.types';

export class OnboardingReminderCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType;

  constructor(
    private readonly offsetDays: OnboardingReminderOffsetDays,
    private readonly config: ConfigService,
  ) {
    this.communicationType = ONBOARDING_REMINDER_COMMUNICATION_TYPE[offsetDays];
  }

  async evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    if (!parseCarerPortalEnabled(this.config.get('CARER_PORTAL_ENABLED'))) {
      return {
        kind: 'skipped',
        code: 'carer_portal_disabled',
        reason: 'Carer portal is disabled.',
      };
    }

    const commRows = await db
      .select({ idempotencyKey: scheduledCommunications.idempotencyKey })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, context.scheduledCommunicationId))
      .limit(1);

    const idempotencyKey = commRows[0]?.idempotencyKey;
    if (!idempotencyKey) {
      return { kind: 'stale' };
    }

    const parsed = parseOnboardingReminderIdempotencyKey(idempotencyKey);
    if (!parsed || parsed.offsetDays !== this.offsetDays) {
      return { kind: 'stale' };
    }

    const rows = await db
      .select({
        accountId: staffAccounts.id,
        accountEmail: staffAccounts.email,
        accountStatus: staffAccounts.status,
        onboardingCompletedAt: staffAccounts.onboardingCompletedAt,
        staffId: staffAccounts.staffId,
        staffEmail: staff.email,
        legalFirstName: staff.legalFirstName,
      })
      .from(staffAccounts)
      .innerJoin(staff, eq(staff.id, staffAccounts.staffId))
      .where(eq(staffAccounts.id, parsed.accountId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { kind: 'stale' };
    }

    if (row.onboardingCompletedAt) {
      return { kind: 'stale' };
    }

    if (row.accountStatus === 'disabled') {
      return { kind: 'stale' };
    }

    const recipientEmail = normalizeNotificationEmail(
      normalizeStaffEmail(row.accountEmail) ?? normalizeStaffEmail(row.staffEmail),
    );
    if (!recipientEmail || !isValidNotificationEmail(recipientEmail)) {
      return {
        kind: 'permanent_failure',
        code: 'invalid_recipient',
        reason: 'No valid email address for this carer.',
      };
    }

    const platformEnv: PlatformUrlEnv = {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };

    const content = buildOnboardingReminderEmailContent({
      legalFirstName: row.legalFirstName,
      platformEnv,
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

export function registerOnboardingReminderProcessors(
  registry: {
    register(processor: CommunicationProcessor): void;
  },
  config: ConfigService,
): void {
  for (const offset of [1, 3, 7, 14, 30] as const) {
    registry.register(new OnboardingReminderCommunicationProcessor(offset, config));
  }
}
