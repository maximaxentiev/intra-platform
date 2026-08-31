import { Inject, Injectable, Logger } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { getStaffLegalFullName } from '@intra/shared';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centreContacts, centres, shifts, staff, staffAccounts } from '../db/schema';
import { EmailService } from '../email/email.service';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { normalizeStaffEmail } from '../staff-portal/portal-account-status.util';
import type { ShiftAssignmentRecipientResult } from './dto/shift-assignment.dto';
import {
  SHIFT_ASSIGNMENT_SKIP_REASON,
  isValidNotificationEmail,
  normalizeNotificationEmail,
  sanitizeNotificationFailure,
} from './shift-assignment-notification.util';
import { normalizeShiftRoleNeeded } from './shift-assignment-display.util';
import { buildShiftManualUnassignCarerEmailContent } from './shift-manual-unassign-carer-email.template';
import { buildShiftManualUnassignCentreEmailContent } from './shift-manual-unassign-centre-email.template';
import { ShiftCommunicationPolicyService } from './shift-communication-policy.service';
import { centreDeferredRecipientResult } from './shift-communication-policy.util';

@Injectable()
export class ShiftManualUnassignCommunicationService {
  private readonly logger = new Logger(ShiftManualUnassignCommunicationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly email: EmailService,
    private readonly platformAudit: PlatformAuditService,
    private readonly communicationPolicy: ShiftCommunicationPolicyService,
  ) {}

  async sendCommunications(params: {
    shiftId: string;
    centreId: string;
    previousStaffId: string;
    actorUserId: string;
    recipients: { centre: boolean; carer: boolean };
  }): Promise<{ centre: ShiftAssignmentRecipientResult | null; carer: ShiftAssignmentRecipientResult | null }> {
    const context = await this.loadContext(params.shiftId, params.previousStaffId);
    const policy = await this.communicationPolicy.resolveForShift(params.shiftId);

    let centre: ShiftAssignmentRecipientResult | null = null;
    if (params.recipients.centre) {
      centre = policy.centreCommunicationDeferred
        ? centreDeferredRecipientResult()
        : await this.sendCentreEmail({ ...params, context });
    }

    let carer: ShiftAssignmentRecipientResult | null = null;
    if (params.recipients.carer) {
      carer = await this.sendCarerEmail({ ...params, context });
    }

    return { centre, carer };
  }

  private async loadContext(shiftId: string, previousStaffId: string) {
    const rows = await this.db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        centreName: centres.name,
        legalName: staff.legalName,
        legalFirstName: staff.legalFirstName,
        legalLastName: staff.legalLastName,
        staffEmail: staff.email,
        accountEmail: staffAccounts.email,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .innerJoin(staff, eq(staff.id, previousStaffId))
      .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
      .where(eq(shifts.id, shiftId));

    const row = rows[0];
    if (!row) throw new Error('Shift context not found for manual unassign communication.');

    return {
      centreName: row.centreName,
      shiftDate: String(row.shiftDate),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      carerLegalName: getStaffLegalFullName({
        legalFirstName: row.legalFirstName,
        legalLastName: row.legalLastName,
        legalName: row.legalName,
      }),
      carerStaffEmail: row.staffEmail,
      carerAccountEmail: row.accountEmail,
    };
  }

  private async sendCentreEmail(params: {
    shiftId: string;
    centreId: string;
    previousStaffId: string;
    actorUserId: string;
    context: Awaited<ReturnType<ShiftManualUnassignCommunicationService['loadContext']>>;
  }): Promise<ShiftAssignmentRecipientResult> {
    const primary = await this.db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, params.centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const primaryEmail = primary[0]?.email?.trim() ?? '';
    if (!primary[0]) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.noCentrePrimaryContact };
    }
    if (!primaryEmail) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.noCentreEmail };
    }
    if (!isValidNotificationEmail(primaryEmail)) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.invalidCentreEmail };
    }
    if (!this.email.isConfigured()) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured };
    }

    const content = buildShiftManualUnassignCentreEmailContent({
      carerLegalName: params.context.carerLegalName,
    });
    const recipientEmail = normalizeNotificationEmail(primaryEmail);

    try {
      const result = await this.email.send({
        to: recipientEmail,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.recordAudit(params, 'centre', recipientEmail, true, result.providerId ?? null);
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.recordAudit(params, 'centre', recipientEmail, false, null, failure);
      this.logger.warn(`Manual unassign centre email failed shiftId=${params.shiftId}`);
      return { attempted: true, sent: false };
    }
  }

  private async sendCarerEmail(params: {
    shiftId: string;
    centreId: string;
    previousStaffId: string;
    actorUserId: string;
    context: Awaited<ReturnType<ShiftManualUnassignCommunicationService['loadContext']>>;
  }): Promise<ShiftAssignmentRecipientResult> {
    const recipientRaw = params.context.carerAccountEmail ?? params.context.carerStaffEmail;
    const normalizedStaffEmail = normalizeStaffEmail(params.context.carerStaffEmail);
    const recipientCandidate = recipientRaw?.trim()
      ? normalizeNotificationEmail(recipientRaw)
      : normalizedStaffEmail;

    if (!recipientCandidate) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.noCarerEmail };
    }
    if (!isValidNotificationEmail(recipientCandidate)) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.invalidCarerEmail };
    }
    if (!this.email.isConfigured()) {
      return { attempted: false, sent: false, skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured };
    }

    const content = buildShiftManualUnassignCarerEmailContent({
      centreName: params.context.centreName,
      shiftDate: params.context.shiftDate,
      startTime: params.context.startTime,
      endTime: params.context.endTime,
      roleNeeded: params.context.roleNeeded,
    });

    try {
      const result = await this.email.send({
        to: recipientCandidate,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.recordAudit(params, 'carer', recipientCandidate, true, result.providerId ?? null);
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.recordAudit(params, 'carer', recipientCandidate, false, null, failure);
      this.logger.warn(`Manual unassign carer email failed shiftId=${params.shiftId}`);
      return { attempted: true, sent: false };
    }
  }

  private async recordAudit(
    params: {
      shiftId: string;
      centreId: string;
      previousStaffId: string;
      actorUserId: string;
    },
    recipientType: 'centre' | 'carer',
    recipientEmail: string,
    sent: boolean,
    providerMessageId: string | null,
    failure?: { code: string; reason: string },
  ): Promise<void> {
    await this.platformAudit.record({
      action: sent
        ? PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent
        : PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationFailed,
      actorType: 'ops_user',
      actorUserId: params.actorUserId,
      shiftId: params.shiftId,
      centreId: params.centreId,
      staffId: recipientType === 'carer' ? params.previousStaffId : null,
      entityId: params.shiftId,
      metadata: {
        source: 'manual_unassign',
        recipientType,
        recipientEmail,
        includedChanges: [],
        ...(providerMessageId ? { deliveryMessageId: providerMessageId } : {}),
        ...(failure?.code ? { failureCode: failure.code } : {}),
        ...(failure?.reason ? { failureReason: failure.reason } : {}),
      },
    });
  }
}
