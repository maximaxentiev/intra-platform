import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { getStaffLegalFullName } from '@intra/shared';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centreContacts, centres, staff, staffAccounts } from '../db/schema';
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
import { buildShiftUpdateCarerEmailContent } from './shift-update-carer-email.template';
import { buildShiftUpdateCentreEmailContent } from './shift-update-centre-email.template';
import type {
  ShiftCommunicationChange,
  ShiftCommunicationField,
  ValidatedShiftUpdateCommunications,
} from './shift-update-changes.util';

@Injectable()
export class ShiftUpdateCommunicationService {
  private readonly logger = new Logger(ShiftUpdateCommunicationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly email: EmailService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async sendCommunications(params: {
    shiftId: string;
    centreId: string;
    assignedStaffId: string | null;
    actorUserId: string;
    changes: ShiftCommunicationChange[];
    selections: ValidatedShiftUpdateCommunications;
  }): Promise<{ centre: ShiftAssignmentRecipientResult | null; carer: ShiftAssignmentRecipientResult | null }> {
    const context = await this.loadContext(params.shiftId, params.centreId, params.assignedStaffId);

    const centre = params.selections.centre
      ? await this.sendCentreEmail({
          ...params,
          context,
          include: params.selections.centre.include,
        })
      : null;

    const carer = params.selections.carer
      ? await this.sendCarerEmail({
          ...params,
          context,
          include: params.selections.carer.include,
        })
      : null;

    return { centre, carer };
  }

  private async loadContext(shiftId: string, centreId: string, assignedStaffId: string | null) {
    const centreRows = await this.db
      .select({ name: centres.name })
      .from(centres)
      .where(eq(centres.id, centreId));
    const centreName = centreRows[0]?.name ?? 'Centre';

    let carerLegalName: string | null = null;
    let carerStaffEmail = '';
    let carerAccountEmail: string | null = null;

    if (assignedStaffId) {
      const staffRows = await this.db
        .select({
          legalName: staff.legalName,
          legalFirstName: staff.legalFirstName,
          legalLastName: staff.legalLastName,
          email: staff.email,
          accountEmail: staffAccounts.email,
        })
        .from(staff)
        .leftJoin(staffAccounts, eq(staffAccounts.staffId, staff.id))
        .where(eq(staff.id, assignedStaffId));
      const row = staffRows[0];
      if (row) {
        carerLegalName = getStaffLegalFullName({
          legalFirstName: row.legalFirstName,
          legalLastName: row.legalLastName,
          legalName: row.legalName,
        });
        carerStaffEmail = row.email;
        carerAccountEmail = row.accountEmail;
      }
    }

    return { shiftId, centreName, carerLegalName, carerStaffEmail, carerAccountEmail };
  }

  private filterChanges(
    changes: ShiftCommunicationChange[],
    include: ShiftCommunicationField[],
  ): ShiftCommunicationChange[] {
    const allowed = new Set(include);
    return changes.filter((change) => allowed.has(change.field));
  }

  private async sendCentreEmail(params: {
    shiftId: string;
    centreId: string;
    assignedStaffId: string | null;
    actorUserId: string;
    changes: ShiftCommunicationChange[];
    include: ShiftCommunicationField[];
    context: Awaited<ReturnType<ShiftUpdateCommunicationService['loadContext']>>;
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
      return {
        attempted: false,
        sent: false,
        skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.invalidCentreEmail,
      };
    }
    if (!this.email.isConfigured()) {
      return {
        attempted: false,
        sent: false,
        skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured,
      };
    }

    const includedChanges = this.filterChanges(params.changes, params.include);
    const content = buildShiftUpdateCentreEmailContent({
      centreName: params.context.centreName,
      carerLegalName: params.context.carerLegalName,
      includedChanges,
    });

    const recipientEmail = normalizeNotificationEmail(primaryEmail);
    try {
      const result = await this.email.send({
        to: recipientEmail,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.recordAudit(params, 'centre', recipientEmail, true, params.include, result.providerId ?? null);
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.recordAudit(params, 'centre', recipientEmail, false, params.include, null, failure);
      this.logger.warn(`Centre shift update email failed shiftId=${params.shiftId}`);
      return { attempted: true, sent: false };
    }
  }

  private async sendCarerEmail(params: {
    shiftId: string;
    centreId: string;
    assignedStaffId: string | null;
    actorUserId: string;
    changes: ShiftCommunicationChange[];
    include: ShiftCommunicationField[];
    context: Awaited<ReturnType<ShiftUpdateCommunicationService['loadContext']>>;
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
      return {
        attempted: false,
        sent: false,
        skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.invalidCarerEmail,
      };
    }
    if (!this.email.isConfigured()) {
      return {
        attempted: false,
        sent: false,
        skippedReason: SHIFT_ASSIGNMENT_SKIP_REASON.emailNotConfigured,
      };
    }

    const includedChanges = this.filterChanges(params.changes, params.include);
    const content = buildShiftUpdateCarerEmailContent({
      centreName: params.context.centreName,
      includedChanges,
    });

    try {
      const result = await this.email.send({
        to: recipientCandidate,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.recordAudit(params, 'carer', recipientCandidate, true, params.include, result.providerId ?? null);
      return { attempted: true, sent: true };
    } catch (err) {
      const failure = sanitizeNotificationFailure(err);
      await this.recordAudit(params, 'carer', recipientCandidate, false, params.include, null, failure);
      this.logger.warn(`Carer shift update email failed shiftId=${params.shiftId}`);
      return { attempted: true, sent: false };
    }
  }

  private async recordAudit(
    params: {
      shiftId: string;
      centreId: string;
      assignedStaffId: string | null;
      actorUserId: string;
    },
    recipientType: 'centre' | 'carer',
    recipientEmail: string,
    sent: boolean,
    includedChanges: ShiftCommunicationField[],
    providerId: string | null,
    failure?: { code: string; reason: string },
  ) {
    await this.platformAudit.record({
      action: sent
        ? PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationSent
        : PLATFORM_AUDIT_ACTIONS.shiftUpdateCommunicationFailed,
      actorType: 'ops_user',
      actorUserId: params.actorUserId,
      shiftId: params.shiftId,
      centreId: params.centreId,
      staffId: recipientType === 'carer' ? params.assignedStaffId : null,
      entityId: params.shiftId,
      metadata: {
        recipientType,
        recipientEmail,
        includedChanges,
        providerId,
        failureCode: failure?.code,
        failureReason: failure?.reason,
      },
    });
  }
}

export function assertShiftUpdateCommunicationsSelection(input: {
  changes: readonly ShiftCommunicationChange[];
  selections: ValidatedShiftUpdateCommunications;
}) {
  const changedFields = new Set(input.changes.map((change) => change.field));

  for (const config of Object.values(input.selections)) {
    if (!config) continue;
    for (const field of config.include) {
      if (!changedFields.has(field)) {
        throw new BadRequestException(
          `Communication cannot include ${field} because it did not change.`,
        );
      }
    }
  }
}
