import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { PlatformUrlEnv } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import { centres, scheduledCommunications, shifts, staff, staffAccounts } from '../db/schema';
import type { CommunicationProcessor } from '../automated-communications/communication-processor.registry';
import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from '../automated-communications/automated-communications.types';
import type { CommunicationProcessorContext } from '../automated-communications/communication-processor.registry';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from './shift-assignment-notification.util';
import { normalizeShiftRoleNeeded } from './shift-assignment-display.util';
import {
  normalizeStaffEmail,
  resolvePortalAccountDisplayStatus,
} from '../staff-portal/portal-account-status.util';
import { buildShiftReminderCarerEmailContent } from './shift-reminder-carer-email.template';
import { planFutureShiftReminders } from './shift-reminder-scheduling.util';
import {
  SHIFT_REMINDER_COMMUNICATION_TYPE,
  parseShiftReminderIdempotencyKey,
  scheduleVersionFromShift,
  type ShiftReminderInterval,
} from './shift-reminder.types';
import { torontoShiftStartInstant } from './shift-toronto.util';

export class ShiftReminderCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType;

  constructor(
    private readonly interval: ShiftReminderInterval,
    private readonly config: ConfigService,
  ) {
    this.communicationType = SHIFT_REMINDER_COMMUNICATION_TYPE[interval];
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

    const parsed = parseShiftReminderIdempotencyKey(idempotencyKey);
    if (!parsed || parsed.interval !== this.interval) {
      return { kind: 'stale' };
    }

    const rows = await db
      .select({
        shiftId: shifts.id,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        centreName: centres.name,
        centreAddress: centres.address,
        centreCity: centres.city,
        centreNotes: centres.notes,
        staffEmail: staff.email,
        accountEmail: staffAccounts.email,
        accountStatus: staffAccounts.status,
        onboardingCompletedAt: staffAccounts.onboardingCompletedAt,
        passwordHash: staffAccounts.passwordHash,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .innerJoin(staff, eq(staff.id, parsed.assignedStaffId))
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(shifts.id, parsed.shiftId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { kind: 'stale' };
    }

    if (row.status !== 'filled') {
      return { kind: 'stale' };
    }

    if (row.assignedStaffId !== parsed.assignedStaffId) {
      return { kind: 'stale' };
    }

    const shiftDate = String(row.shiftDate);
    const startTime = String(row.startTime);
    if (scheduleVersionFromShift(shiftDate, startTime) !== parsed.scheduleVersion) {
      return { kind: 'stale' };
    }

    const now = new Date();
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    if (shiftStart.getTime() <= now.getTime()) {
      return { kind: 'stale' };
    }

    const expectedPlans = planFutureShiftReminders(shiftDate, startTime, now);
    if (!expectedPlans.some((plan) => plan.interval === parsed.interval)) {
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

    const account =
      row.accountEmail != null
        ? ({
            status: row.accountStatus!,
            onboardingCompletedAt: row.onboardingCompletedAt,
            passwordHash: row.passwordHash,
          } as Parameters<typeof resolvePortalAccountDisplayStatus>[0])
        : null;

    const content = buildShiftReminderCarerEmailContent({
      interval: parsed.interval,
      centreName: row.centreName,
      centreAddress: row.centreAddress,
      centreCity: row.centreCity,
      centreNotes: row.centreNotes,
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      shiftDate,
      startTime,
      endTime: String(row.endTime),
      shiftId: parsed.shiftId,
      includePortalLink: resolvePortalAccountDisplayStatus(account) === 'active',
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

export function registerShiftReminderProcessors(
  registry: { register(processor: CommunicationProcessor): void },
  config: ConfigService,
): void {
  for (const interval of ['3d', '1d', '2h'] as const) {
    registry.register(new ShiftReminderCommunicationProcessor(interval, config));
  }
}
