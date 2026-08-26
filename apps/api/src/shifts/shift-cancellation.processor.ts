import type { ConfigService } from '@nestjs/config';
import { asc, eq } from 'drizzle-orm';
import type { PlatformUrlEnv } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import {
  centreContacts,
  centres,
  scheduledCommunications,
  shifts,
  staff,
  staffAccounts,
} from '../db/schema';
import type { CommunicationProcessor } from '../automated-communications/communication-processor.registry';
import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from '../automated-communications/automated-communications.types';
import type { CommunicationProcessorContext } from '../automated-communications/communication-processor.registry';
import { getStaffLegalFullName } from '@intra/shared';
import {
  normalizeStaffEmail,
  resolvePortalAccountDisplayStatus,
} from '../staff-portal/portal-account-status.util';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from './shift-assignment-notification.util';
import { normalizeShiftRoleNeeded } from './shift-assignment-display.util';
import { buildShiftCancellationCentreEmailContent } from './shift-cancellation-centre-email.template';
import { buildShiftCancellationCarerEmailContent } from './shift-cancellation-carer-email.template';
import { parseShiftCancellationIdempotencyKey } from './shift-cancellation.types';

abstract class ShiftCancellationCommunicationProcessorBase implements CommunicationProcessor {
  abstract readonly communicationType: CommunicationType;
  protected abstract expectedRecipient: 'centre' | 'carer';

  constructor(protected readonly config: ConfigService) {}

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

    const parsed = parseShiftCancellationIdempotencyKey(idempotencyKey);
    if (!parsed || parsed.recipient !== this.expectedRecipient) return { kind: 'stale' };

    const rows = await db
      .select({
        shiftId: shifts.id,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        centreId: shifts.centreId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        centreName: centres.name,
        centreAddress: centres.address,
        centreCity: centres.city,
        legalName: staff.legalName,
        legalFirstName: staff.legalFirstName,
        legalLastName: staff.legalLastName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        staffEmail: staff.email,
        accountEmail: staffAccounts.email,
        accountStatus: staffAccounts.status,
        onboardingCompletedAt: staffAccounts.onboardingCompletedAt,
        passwordHash: staffAccounts.passwordHash,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(staff, eq(staff.id, shifts.assignedStaffId))
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(shifts.id, parsed.shiftId))
      .limit(1);

    const row = rows[0];
    if (!row) return { kind: 'stale' };
    if (row.status !== 'cancelled') return { kind: 'stale' };
    if (!row.assignedStaffId) return { kind: 'stale' };

    if (this.expectedRecipient === 'carer') {
      if (context.recipientEntityId && context.recipientEntityId !== row.assignedStaffId) {
        return { kind: 'stale' };
      }
      return this.buildCarerOutcome(row, parsed.shiftId);
    }

    if (context.recipientEntityId && context.recipientEntityId !== row.centreId) {
      return { kind: 'stale' };
    }
    return this.buildCentreOutcome(db, row);
  }

  private async buildCentreOutcome(
    db: Database,
    row: {
      centreId: string;
      centreName: string;
      shiftDate: string | Date;
      startTime: string;
      endTime: string;
      roleNeeded: string | null;
      assignedStaffId: string | null;
      legalName: string | null;
      legalFirstName: string | null;
      legalLastName: string | null;
      displayName: string | null;
      useDisplayName: boolean | null;
    },
  ): Promise<CommunicationProcessorOutcome> {
    if (!row.assignedStaffId) return { kind: 'stale' };

    const primary = await db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, row.centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const primaryEmail = primary[0]?.email?.trim() ?? '';
    if (!primary[0] || !primaryEmail) {
      return {
        kind: 'skipped',
        code: 'no_centre_primary_contact',
        reason: 'Centre has no primary contact email.',
      };
    }
    if (!isValidNotificationEmail(primaryEmail)) {
      return {
        kind: 'skipped',
        code: 'invalid_centre_email',
        reason: 'Centre primary contact email is invalid.',
      };
    }

    const carerLegalName = getStaffLegalFullName({
      legalFirstName: row.legalFirstName ?? '',
      legalLastName: row.legalLastName ?? '',
      legalName: row.legalName ?? '',
    });

    const content = buildShiftCancellationCentreEmailContent({
      centreName: row.centreName,
      carerLegalName,
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      shiftDate: String(row.shiftDate),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
    });

    return {
      kind: 'valid',
      recipientEmail: normalizeNotificationEmail(primaryEmail),
      subject: content.subject,
      html: content.html,
      text: content.text,
    };
  }

  private buildCarerOutcome(
    row: {
      centreName: string;
      centreAddress: string;
      centreCity: string;
      shiftDate: string | Date;
      startTime: string;
      endTime: string;
      roleNeeded: string | null;
      staffEmail: string | null;
      accountEmail: string | null;
      accountStatus: string | null;
      onboardingCompletedAt: Date | null;
      passwordHash: string | null;
    },
    shiftId: string,
  ): CommunicationProcessorOutcome {
    const recipientRaw = row.accountEmail ?? row.staffEmail;
    const normalizedStaffEmail = normalizeStaffEmail(row.staffEmail ?? '');
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

    const content = buildShiftCancellationCarerEmailContent({
      centreName: row.centreName,
      centreAddress: row.centreAddress,
      centreCity: row.centreCity,
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      shiftDate: String(row.shiftDate),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      shiftId,
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

export class ShiftCancellationCentreCommunicationProcessor extends ShiftCancellationCommunicationProcessorBase {
  readonly communicationType = 'shift_cancellation_centre' as const;
  protected readonly expectedRecipient = 'centre' as const;
}

export class ShiftCancellationCarerCommunicationProcessor extends ShiftCancellationCommunicationProcessorBase {
  readonly communicationType = 'shift_cancellation_carer' as const;
  protected readonly expectedRecipient = 'carer' as const;
}

export function registerShiftCancellationProcessors(
  registry: { register(processor: CommunicationProcessor): void },
  config: ConfigService,
): void {
  registry.register(new ShiftCancellationCentreCommunicationProcessor(config));
  registry.register(new ShiftCancellationCarerCommunicationProcessor(config));
}
