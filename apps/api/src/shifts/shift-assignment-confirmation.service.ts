import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { asc, eq } from 'drizzle-orm';
import type { PlatformUrlEnv } from '../config/platform-url';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centreContacts, centres, shifts, staff, staffAccounts } from '../db/schema';
import { EmailService } from '../email/email.service';
import { getStaffLegalFullName } from '@intra/shared';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import {
  normalizeStaffEmail,
  resolvePortalAccountDisplayStatus,
} from '../staff-portal/portal-account-status.util';
import type {
  ShiftAssignmentNotificationsResult,
  ShiftAssignmentRecipientResult,
} from './dto/shift-assignment.dto';
import { buildShiftAssignmentCarerEmailContent } from './shift-assignment-carer-email.template';
import { buildShiftAssignmentCentreEmailContent } from './shift-assignment-centre-email.template';
import { normalizeShiftRoleNeeded } from './shift-assignment-display.util';
import {
  SHIFT_ASSIGNMENT_SKIP_REASON,
  isValidNotificationEmail,
  normalizeNotificationEmail,
  sanitizeNotificationFailure,
} from './shift-assignment-notification.util';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';

type ConfirmationTrigger = 'assign' | 'resend';

type ShiftNotificationContext = {
  shiftId: string;
  assignedStaffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  centreId: string;
  centreName: string;
  centreAddress: string;
  centreCity: string;
  centreNotes: string;
  carerLegalName: string;
  carerStaffEmail: string;
  carerAccountEmail: string | null;
  includePortalLink: boolean;
};

@Injectable()
export class ShiftAssignmentConfirmationService {
  private readonly logger = new Logger(ShiftAssignmentConfirmationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly notifications: ShiftAssignmentNotificationsService,
    private readonly shareLifecycle: StaffDocumentShareLifecycleService,
  ) {}

  async sendAssignmentConfirmations(params: {
    shiftId: string;
    assignedStaffId: string;
    actorUserId: string;
    trigger: ConfirmationTrigger;
    recipients?: { centre?: boolean; carer?: boolean };
  }): Promise<ShiftAssignmentNotificationsResult> {
    const sendCentre = params.recipients?.centre ?? true;
    const sendCarer = params.recipients?.carer ?? true;
    const context = await this.loadContext(params.shiftId, params.assignedStaffId);
    const platformEnv = this.platformEnv();

    const centre = sendCentre
      ? await this.processCentreConfirmation(context, params, platformEnv)
      : { attempted: false, sent: false };
    const carer = sendCarer
      ? await this.processCarerConfirmation(context, params, platformEnv)
      : { attempted: false, sent: false };

    return { centre, carer };
  }

  private async loadContext(
    shiftId: string,
    assignedStaffId: string,
  ): Promise<ShiftNotificationContext> {
    const rows = await this.db
      .select({
        shiftId: shifts.id,
        assignedStaffId: shifts.assignedStaffId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        centreId: shifts.centreId,
        centreName: centres.name,
        centreAddress: centres.address,
        centreCity: centres.city,
        centreNotes: centres.notes,
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
      .innerJoin(staff, eq(staff.id, assignedStaffId))
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(shifts.id, shiftId));

    const row = rows[0];
    if (!row) throw new NotFoundException('Shift not found.');
    if (row.assignedStaffId !== assignedStaffId) {
      throw new BadRequestException('Shift is not assigned to the requested staff member.');
    }

    const account =
      row.accountEmail != null
        ? ({
            status: row.accountStatus!,
            onboardingCompletedAt: row.onboardingCompletedAt,
            passwordHash: row.passwordHash,
          } as Parameters<typeof resolvePortalAccountDisplayStatus>[0])
        : null;

    return {
      shiftId: row.shiftId,
      assignedStaffId,
      shiftDate: String(row.shiftDate),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      centreId: row.centreId,
      centreName: row.centreName,
      centreAddress: row.centreAddress,
      centreCity: row.centreCity,
      centreNotes: row.centreNotes,
      carerLegalName: getStaffLegalFullName({
        legalFirstName: row.legalFirstName,
        legalLastName: row.legalLastName,
        legalName: row.legalName,
      }),
      carerStaffEmail: row.staffEmail,
      carerAccountEmail: row.accountEmail,
      includePortalLink: resolvePortalAccountDisplayStatus(account) === 'active',
    };
  }

  private async processCentreConfirmation(
    context: ShiftNotificationContext,
    params: {
      shiftId: string;
      assignedStaffId: string;
      actorUserId: string;
      trigger: ConfirmationTrigger;
    },
    _platformEnv: PlatformUrlEnv,
  ): Promise<ShiftAssignmentRecipientResult> {
    const primary = await this.db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, context.centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const primaryEmail = primary[0]?.email?.trim() ?? '';
    if (!primary[0]) {
      return this.recordSkipped(params, 'centre', '', SHIFT_ASSIGNMENT_SKIP_REASON.noCentrePrimaryContact);
    }
    if (!primaryEmail) {
      return this.recordSkipped(params, 'centre', '', SHIFT_ASSIGNMENT_SKIP_REASON.noCentreEmail);
    }
    if (!isValidNotificationEmail(primaryEmail)) {
      return this.recordSkipped(
        params,
        'centre',
        primaryEmail,
        SHIFT_ASSIGNMENT_SKIP_REASON.invalidCentreEmail,
      );
    }

    if (!this.email.isConfigured()) {
      return this.recordSkipped(
        params,
        'centre',
        normalizeNotificationEmail(primaryEmail),
        SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured,
      );
    }

    const documentShareUrl = await this.resolveDocumentShareUrl(
      context.assignedStaffId,
      params.actorUserId,
    );
    if (!documentShareUrl) {
      return this.recordSkipped(
        params,
        'centre',
        normalizeNotificationEmail(primaryEmail),
        SHIFT_ASSIGNMENT_SKIP_REASON.documentShareUnavailable,
      );
    }

    const content = buildShiftAssignmentCentreEmailContent({
      centreName: context.centreName,
      carerLegalName: context.carerLegalName,
      roleNeeded: context.roleNeeded,
      shiftDate: context.shiftDate,
      startTime: context.startTime,
      endTime: context.endTime,
      documentShareUrl,
    });

    const recipientEmail = normalizeNotificationEmail(primaryEmail);
    try {
      const result = await this.email.send({
        to: recipientEmail,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.notifications.record({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        recipientType: 'centre',
        recipientEmail,
        trigger: params.trigger,
        status: 'sent',
        providerId: result.providerId ?? null,
        actorUserId: params.actorUserId,
        sentAt: new Date(),
      });
      this.logger.log(
        `Centre assignment confirmation sent shiftId=${params.shiftId} notification=centre`,
      );
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.notifications.record({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        recipientType: 'centre',
        recipientEmail,
        trigger: params.trigger,
        status: 'failed',
        failureCode: failure.code,
        failureReason: failure.reason,
        actorUserId: params.actorUserId,
      });
      this.logger.warn(
        `Centre assignment confirmation failed shiftId=${params.shiftId} code=${failure.code}`,
      );
      return { attempted: true, sent: false };
    }
  }

  private async processCarerConfirmation(
    context: ShiftNotificationContext,
    params: {
      shiftId: string;
      assignedStaffId: string;
      actorUserId: string;
      trigger: ConfirmationTrigger;
    },
    platformEnv: PlatformUrlEnv,
  ): Promise<ShiftAssignmentRecipientResult> {
    const recipientRaw = context.carerAccountEmail ?? context.carerStaffEmail;
    const normalizedStaffEmail = normalizeStaffEmail(context.carerStaffEmail);
    const recipientCandidate = recipientRaw?.trim()
      ? normalizeNotificationEmail(recipientRaw)
      : normalizedStaffEmail;

    if (!recipientCandidate) {
      return this.recordSkipped(params, 'carer', '', SHIFT_ASSIGNMENT_SKIP_REASON.noCarerEmail);
    }
    if (!isValidNotificationEmail(recipientCandidate)) {
      return this.recordSkipped(
        params,
        'carer',
        recipientCandidate,
        SHIFT_ASSIGNMENT_SKIP_REASON.invalidCarerEmail,
      );
    }

    if (!this.email.isConfigured()) {
      return this.recordSkipped(
        params,
        'carer',
        recipientCandidate,
        SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured,
      );
    }

    const content = buildShiftAssignmentCarerEmailContent({
      centreName: context.centreName,
      centreAddress: context.centreAddress,
      centreCity: context.centreCity,
      centreNotes: context.centreNotes,
      roleNeeded: context.roleNeeded,
      shiftDate: context.shiftDate,
      startTime: context.startTime,
      endTime: context.endTime,
      shiftId: context.shiftId,
      includePortalLink: context.includePortalLink,
      platformEnv,
    });

    try {
      const result = await this.email.send({
        to: recipientCandidate,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.notifications.record({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        recipientType: 'carer',
        recipientEmail: recipientCandidate,
        trigger: params.trigger,
        status: 'sent',
        providerId: result.providerId ?? null,
        actorUserId: params.actorUserId,
        sentAt: new Date(),
      });
      this.logger.log(
        `Carer assignment confirmation sent shiftId=${params.shiftId} notification=carer`,
      );
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.notifications.record({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        recipientType: 'carer',
        recipientEmail: recipientCandidate,
        trigger: params.trigger,
        status: 'failed',
        failureCode: failure.code,
        failureReason: failure.reason,
        actorUserId: params.actorUserId,
      });
      this.logger.warn(
        `Carer assignment confirmation failed shiftId=${params.shiftId} code=${failure.code}`,
      );
      return { attempted: true, sent: false };
    }
  }

  private async resolveDocumentShareUrl(
    staffId: string,
    actorUserId: string,
  ): Promise<string | null> {
    const existing = await this.shareLifecycle.buildActiveStaffDocumentShareUrl(staffId);
    if (existing) return existing;

    try {
      const generated = await this.shareLifecycle.generateShareLink(staffId, actorUserId);
      return generated.shareUrl;
    } catch (err) {
      this.logger.warn(
        `Document share unavailable for staffId=${staffId}: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`,
      );
      return null;
    }
  }

  private async recordSkipped(
    params: {
      shiftId: string;
      assignedStaffId: string;
      actorUserId: string;
      trigger: ConfirmationTrigger;
    },
    recipientType: 'centre' | 'carer',
    recipientEmail: string,
    reason: string,
  ): Promise<ShiftAssignmentRecipientResult> {
    await this.notifications.record({
      shiftId: params.shiftId,
      assignedStaffId: params.assignedStaffId,
      recipientType,
      recipientEmail,
      trigger: params.trigger,
      status: 'skipped',
      failureCode: reason,
      failureReason: reason,
      actorUserId: params.actorUserId,
    });
    return { attempted: false, sent: false, skippedReason: reason };
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
