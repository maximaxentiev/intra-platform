import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { aliasedTable, asc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centreContacts, shiftBatches, shifts, staff } from '../db/schema';
import {
  isValidNotificationEmail,
  normalizeNotificationEmail,
} from '../shifts/shift-assignment-notification.util';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { resolveBatchFinalCarerLegalName } from './shift-batch-confirmation-final-email.template';
import type {
  BatchCompletionBlocker,
  BatchCompletionReadinessDto,
} from './shift-batch-completion.types';
import { computeBatchProgressCounts } from './shift-batch-progress.util';
import { fmtTimeLabel } from './shift-batch-completion.util';

const assignee = aliasedTable(staff, 'assignee');

@Injectable()
export class ShiftBatchCompletionReadinessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly shareLifecycle: StaffDocumentShareLifecycleService,
  ) {}

  async getReadiness(batchId: string): Promise<BatchCompletionReadinessDto> {
    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
      })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');

    if (batch.requestCompletedAt) {
      return {
        ready: false,
        primaryContactEmail: null,
        activeShiftCount: 0,
        fulfilledShiftCount: 0,
        blockers: [
          {
            code: 'batch_already_completed',
            message: 'This Batch Request is already completed.',
          },
        ],
      };
    }

    const childRows = await this.loadActiveChildren(batchId);
    const progress = computeBatchProgressCounts(childRows);
    const blockers: BatchCompletionBlocker[] = [];

    if (progress.activeTotal === 0) {
      blockers.push({
        code: 'no_active_shifts',
        message: 'This Batch Request has no active shifts to complete.',
      });
    }

    for (const child of childRows.filter((row) => row.status !== 'cancelled')) {
      if (child.status === 'pending') {
        blockers.push({
          code: 'unfilled_shift',
          shiftId: child.id,
          shiftDate: String(child.shiftDate),
          startTime: String(child.startTime),
          endTime: String(child.endTime),
          message: `${String(child.shiftDate)} · ${fmtTimeLabel(child.startTime)}–${fmtTimeLabel(child.endTime)} is still unfilled.`,
        });
        continue;
      }

      if (!child.assignedStaffId) {
        blockers.push({
          code: 'missing_assignee',
          shiftId: child.id,
          shiftDate: String(child.shiftDate),
          startTime: String(child.startTime),
          endTime: String(child.endTime),
          message: `${String(child.shiftDate)} · ${fmtTimeLabel(child.startTime)}–${fmtTimeLabel(child.endTime)} has no assigned Carer.`,
        });
        continue;
      }

      const shareAssessment = await this.shareLifecycle.assessDocumentShareReadiness(
        child.assignedStaffId,
      );
      if (!shareAssessment.ready) {
        const carerName = resolveBatchFinalCarerLegalName({
          legalName: child.assignedLegalName,
          legalFirstName: child.assignedLegalFirstName,
          legalLastName: child.assignedLegalLastName,
          displayName: child.assignedDisplayName,
          useDisplayName: child.assignedUseDisplayName,
        });
        blockers.push({
          code: 'document_share_unavailable',
          shiftId: child.id,
          shiftDate: String(child.shiftDate),
          startTime: String(child.startTime),
          endTime: String(child.endTime),
          carerName,
          carerStaffId: child.assignedStaffId,
          message: `Document share unavailable for ${carerName} — ${String(child.shiftDate)}, ${fmtTimeLabel(child.startTime)}–${fmtTimeLabel(child.endTime)}. ${shareAssessment.reason}`,
        });
      }
    }

    const primary = await this.resolvePrimaryContact(batch.centreId);
    if (!primary.ok) {
      blockers.push({
        code: 'missing_primary_contact',
        message: primary.reason,
      });
    }

    const ready =
      blockers.length === 0 &&
      progress.activeTotal > 0 &&
      progress.fulfilledCount === progress.activeTotal;

    return {
      ready,
      primaryContactEmail: primary.ok ? primary.email : null,
      activeShiftCount: progress.activeTotal,
      fulfilledShiftCount: progress.fulfilledCount,
      blockers,
    };
  }

  private async loadActiveChildren(batchId: string) {
    return this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        assignedLegalName: assignee.legalName,
        assignedLegalFirstName: assignee.legalFirstName,
        assignedLegalLastName: assignee.legalLastName,
        assignedDisplayName: assignee.displayName,
        assignedUseDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .where(eq(shifts.batchId, batchId))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime), asc(shifts.id));
  }

  private async resolvePrimaryContact(centreId: string) {
    const rows = await this.db
      .select({ email: centreContacts.email })
      .from(centreContacts)
      .where(eq(centreContacts.centreId, centreId))
      .orderBy(asc(centreContacts.sortOrder))
      .limit(1);

    const raw = rows[0]?.email;
    if (!raw?.trim()) {
      return {
        ok: false as const,
        reason: 'Centre primary contact does not have a valid email.',
      };
    }

    const normalized = normalizeNotificationEmail(raw);
    if (!normalized || !isValidNotificationEmail(normalized)) {
      return {
        ok: false as const,
        reason: 'Centre primary contact does not have a valid email.',
      };
    }

    return { ok: true as const, email: normalized };
  }
}
