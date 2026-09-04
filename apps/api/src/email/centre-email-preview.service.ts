import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { aliasedTable, asc, eq } from 'drizzle-orm';
import { getStaffLegalFullName } from '@intra/shared';
import { resolveCentrePrimaryContact } from '../centres/centre-primary-contact.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staff, shiftBatches } from '../db/schema';
import type { CentreEmailCustomContentInput } from './centre-email-custom-content.util';
import {
  normalizeCentreEmailCustomContent,
  validateCentreEmailMessage,
  validateCentreEmailSubject,
} from './centre-email-custom-content.util';
import { normalizeShiftRoleNeeded } from '../shifts/shift-assignment-display.util';
import {
  buildShiftAssignmentCentreEmailContent,
  defaultShiftAssignmentCentreEmailMessage,
  defaultShiftAssignmentCentreEmailSubject,
} from '../shifts/shift-assignment-centre-email.template';
import {
  buildShiftUpdateCentreEmailContent,
  defaultShiftUpdateCentreEmailMessage,
  defaultShiftUpdateCentreEmailSubject,
} from '../shifts/shift-update-centre-email.template';
import type { ShiftCommunicationChange } from '../shifts/shift-update-changes.util';
import {
  buildBatchConfirmationFinalEmailContent,
  defaultBatchConfirmationFinalEmailMessage,
  defaultBatchConfirmationFinalEmailSubject,
  resolveBatchFinalCarerLegalName,
  type BatchFinalConfirmationShiftBlock,
} from '../shift-batches/shift-batch-confirmation-final-email.template';
import {
  buildBatchConfirmationUpdateEmailContent,
  defaultBatchConfirmationUpdateEmailMessage,
  defaultBatchConfirmationUpdateEmailSubject,
} from '../shift-batches/shift-batch-confirmation-update-email.template';
import { ShiftBatchChangeHistoryService } from '../shift-batches/shift-batch-change-history.service';
import { isActiveFulfilledShift } from '../shift-batches/shift-batch-completion.util';
import { computeBatchProgressCounts } from '../shift-batches/shift-batch-progress.util';
import { CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF } from './centre-email-custom-content.util';

const assignee = aliasedTable(staff, 'assignee');

export type CentreEmailPreviewResponse = {
  recipient: { name: string; email: string } | null;
  subject: string;
  message: string;
  defaultSubject: string;
  defaultMessage: string;
  html: string;
  text: string;
  pendingChangeRevision?: number;
};

@Injectable()
export class CentreEmailPreviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly batchChangeHistory: ShiftBatchChangeHistoryService,
  ) {}

  resolveCustomContent(
    input: CentreEmailCustomContentInput | undefined,
    defaults: { subject: string; message: string },
  ) {
    return normalizeCentreEmailCustomContent(input, defaults);
  }

  async previewAssignmentConfirmation(params: {
    shiftId: string;
    staffId: string;
    custom?: CentreEmailCustomContentInput;
  }): Promise<CentreEmailPreviewResponse> {
    const context = await this.loadAssignmentContext(params.shiftId, params.staffId);
    const recipient = await resolveCentrePrimaryContact(this.db, context.centreId);
    const defaults = {
      subject: defaultShiftAssignmentCentreEmailSubject({
        centreName: context.centreName,
        shiftDate: context.shiftDate,
      }),
      message: defaultShiftAssignmentCentreEmailMessage(),
    };
    const resolved = this.resolveCustomContent(params.custom, defaults);
    const content = buildShiftAssignmentCentreEmailContent({
      centreName: context.centreName,
      carerLegalName: context.carerLegalName,
      roleNeeded: context.roleNeeded,
      shiftDate: context.shiftDate,
      startTime: context.startTime,
      endTime: context.endTime,
      shiftConfirmationNotes: context.shiftConfirmationNotes,
      documentShareUrl: CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF,
      customSubject: resolved.subject,
      customMessage: resolved.message,
      documentSharePreviewMode: true,
    });
    return {
      recipient,
      subject: resolved.subject,
      message: resolved.message,
      defaultSubject: defaults.subject,
      defaultMessage: defaults.message,
      html: content.html,
      text: content.text,
    };
  }

  async previewShiftUpdateConfirmation(params: {
    shiftId: string;
    includedChanges: ShiftCommunicationChange[];
    custom?: CentreEmailCustomContentInput;
  }): Promise<CentreEmailPreviewResponse> {
    const shiftRows = await this.db
      .select({
        centreId: shifts.centreId,
        assignedStaffId: shifts.assignedStaffId,
        centreName: centres.name,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(eq(shifts.id, params.shiftId))
      .limit(1);
    const row = shiftRows[0];
    if (!row) throw new NotFoundException('Shift not found.');

    let carerLegalName: string | null = null;
    if (row.assignedStaffId) {
      const staffRows = await this.db
        .select({
          legalName: staff.legalName,
          legalFirstName: staff.legalFirstName,
          legalLastName: staff.legalLastName,
        })
        .from(staff)
        .where(eq(staff.id, row.assignedStaffId))
        .limit(1);
      const staffRow = staffRows[0];
      if (staffRow) {
        carerLegalName = getStaffLegalFullName({
          legalFirstName: staffRow.legalFirstName,
          legalLastName: staffRow.legalLastName,
          legalName: staffRow.legalName,
        });
      }
    }

    const recipient = await resolveCentrePrimaryContact(this.db, row.centreId);
    const defaults = {
      subject: defaultShiftUpdateCentreEmailSubject(row.centreName),
      message: defaultShiftUpdateCentreEmailMessage(),
    };
    const resolved = this.resolveCustomContent(params.custom, defaults);
    const content = buildShiftUpdateCentreEmailContent({
      centreName: row.centreName,
      carerLegalName,
      includedChanges: params.includedChanges,
      customSubject: resolved.subject,
      customMessage: resolved.message,
    });
    return {
      recipient,
      subject: resolved.subject,
      message: resolved.message,
      defaultSubject: defaults.subject,
      defaultMessage: defaults.message,
      html: content.html,
      text: content.text,
    };
  }

  async previewBatchFinalConfirmation(params: {
    batchId: string;
    custom?: CentreEmailCustomContentInput;
  }): Promise<CentreEmailPreviewResponse> {
    const batch = await this.loadBatch(params.batchId);
    const { assignments, activeCount } = await this.loadBatchAssignments(params.batchId, true);
    const recipient = await resolveCentrePrimaryContact(this.db, batch.centreId);
    const defaults = {
      subject: defaultBatchConfirmationFinalEmailSubject(batch.centreName),
      message: defaultBatchConfirmationFinalEmailMessage({
        activeShiftCount: activeCount,
        centreName: batch.centreName,
      }),
    };
    const resolved = this.resolveCustomContent(params.custom, defaults);
    const content = buildBatchConfirmationFinalEmailContent({
      centreName: batch.centreName,
      activeShiftCount: activeCount,
      assignments,
      customSubject: resolved.subject,
      customMessage: resolved.message,
      documentSharePreviewMode: true,
    });
    return {
      recipient,
      subject: resolved.subject,
      message: resolved.message,
      defaultSubject: defaults.subject,
      defaultMessage: defaults.message,
      html: content.html,
      text: content.text,
    };
  }

  async previewBatchUpdateConfirmation(params: {
    batchId: string;
    selectedChangeIds: string[];
    custom?: CentreEmailCustomContentInput;
  }): Promise<CentreEmailPreviewResponse> {
    const batch = await this.loadBatch(params.batchId);
    const detectedChanges = await this.batchChangeHistory.getDetectedChanges({
      batchId: params.batchId,
      since: batch.lastConfirmationScheduledAt,
    });
    const selected = new Set(params.selectedChangeIds);
    const highlightedChanges = detectedChanges
      .filter((change) => selected.has(change.id))
      .map((change) => change.summary);
    const { assignments } = await this.loadBatchAssignments(params.batchId, true);
    const recipient = await resolveCentrePrimaryContact(this.db, batch.centreId);
    const defaults = {
      subject: defaultBatchConfirmationUpdateEmailSubject(batch.centreName),
      message: defaultBatchConfirmationUpdateEmailMessage(batch.centreName),
    };
    const resolved = this.resolveCustomContent(params.custom, defaults);
    const content = buildBatchConfirmationUpdateEmailContent({
      centreName: batch.centreName,
      highlightedChanges,
      assignments,
      customSubject: resolved.subject,
      customMessage: resolved.message,
      documentSharePreviewMode: true,
    });
    return {
      recipient,
      subject: resolved.subject,
      message: resolved.message,
      defaultSubject: defaults.subject,
      defaultMessage: defaults.message,
      html: content.html,
      text: content.text,
      pendingChangeRevision: batch.pendingChangeRevision,
    };
  }

  parseCentreEmailFromDto(input?: CentreEmailCustomContentInput) {
    if (!input) return undefined;
    return {
      subject: input.subject != null ? validateCentreEmailSubject(input.subject) : undefined,
      message: input.message != null ? validateCentreEmailMessage(input.message) : undefined,
    };
  }

  private async loadAssignmentContext(shiftId: string, staffId: string) {
    const rows = await this.db
      .select({
        shiftId: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        centreId: shifts.centreId,
        centreName: centres.name,
        shiftConfirmationNotes: shifts.shiftConfirmationNotes,
        legalName: staff.legalName,
        legalFirstName: staff.legalFirstName,
        legalLastName: staff.legalLastName,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .innerJoin(staff, eq(staff.id, staffId))
      .where(eq(shifts.id, shiftId))
      .limit(1);

    const row = rows[0];
    if (!row) throw new NotFoundException('Shift not found.');

    return {
      centreId: row.centreId,
      centreName: row.centreName,
      shiftDate: String(row.shiftDate),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      roleNeeded: normalizeShiftRoleNeeded(row.roleNeeded),
      shiftConfirmationNotes: row.shiftConfirmationNotes?.trim() ?? '',
      carerLegalName: getStaffLegalFullName({
        legalFirstName: row.legalFirstName,
        legalLastName: row.legalLastName,
        legalName: row.legalName,
      }),
    };
  }

  private async loadBatch(batchId: string) {
    const rows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        centreName: centres.name,
        pendingChangeRevision: shiftBatches.pendingChangeRevision,
        lastConfirmationScheduledAt: shiftBatches.lastConfirmationScheduledAt,
        requestCompletedAt: shiftBatches.requestCompletedAt,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, batchId))
      .limit(1);
    const batch = rows[0];
    if (!batch) throw new NotFoundException('Batch not found.');
    return batch;
  }

  private async loadBatchAssignments(batchId: string, previewMode: boolean) {
    const childRows = await this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        shiftConfirmationNotes: shifts.shiftConfirmationNotes,
        legalName: assignee.legalName,
        legalFirstName: assignee.legalFirstName,
        legalLastName: assignee.legalLastName,
        displayName: assignee.displayName,
        useDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .where(eq(shifts.batchId, batchId))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));

    const active = childRows.filter((row) => row.status !== 'cancelled');
    const progress = computeBatchProgressCounts(childRows);
    if (progress.activeTotal === 0) {
      throw new BadRequestException('Batch has no active shifts.');
    }

    const assignments: BatchFinalConfirmationShiftBlock[] = active.map((row) => {
      if (!row.assignedStaffId || !isActiveFulfilledShift(row.status)) {
        throw new BadRequestException('Batch has unfilled active shifts.');
      }
      return {
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
        carerLegalName: resolveBatchFinalCarerLegalName({
          legalName: row.legalName,
          legalFirstName: row.legalFirstName,
          legalLastName: row.legalLastName,
          displayName: row.displayName,
          useDisplayName: row.useDisplayName,
        }),
        shiftConfirmationNotes: row.shiftConfirmationNotes ?? '',
        documentShareUrl: previewMode ? CENTRE_EMAIL_DOCUMENT_SHARE_PREVIEW_HREF : '',
      };
    });

    return { assignments, activeCount: active.length };
  }
}
