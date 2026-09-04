import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { getStaffLegalFullName } from '@intra/shared';
import { aliasedTable, and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import {
  centres,
  shiftBatches,
  shiftComments,
  shiftContacted,
  shifts,
  staff,
  users,
} from '../db/schema';
import type {
  ShiftAssignResponse,
  ShiftResendConfirmationsResponse,
  UnassignShiftResponse,
} from './dto/shift-assignment.dto';
import { resolveCentreUsageCentreIds } from '../reports/dto/report-centre-ids.util';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftReminderService } from './shift-reminder.service';
import { ShiftCancellationService } from './shift-cancellation.service';
import { SHIFT_ASSIGN_INELIGIBLE_MESSAGE } from './shift-matching.types';
import { assertSameDayShiftSchedule } from './shift-schedule-validation.util';
import { acquireShiftStaffDateAdvisoryLock } from './shift-staff-date-advisory-lock.util';
import {
  assignmentAuditAction,
  buildShiftUpdateMetadata,
  cancellationReasonPreview,
  shiftAuditSnapshot,
} from './shift-audit.util';
import {
  assertManualCompletionAllowed,
  normalizeRequiredCancellationReason,
  rejectGenericPendingTransition,
} from './shifts-lifecycle.util';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication.service';
import { resolveSelectedRecipients } from './dto/shift-communication-recipients.dto';
import type {
  ResendConfirmationDto,
  ShiftCommunicationRecipientsDto,
  UnassignShiftDto,
} from './dto/shift-communication-recipients.dto';
import {
  AddCommentDto,
  ChangeStatusDto,
  ListShiftsQuery,
  PreviewUpdateShiftDto,
  UpdateShiftDto,
  UpsertShiftDto,
} from './dto/shifts.dto';
import {
  assertActiveShiftRoleForCreate,
  assertShiftRoleUpdateAllowed,
} from './shift-role-update.util';
import {
  ShiftUpdateCommunicationService,
  assertShiftUpdateCommunicationsSelection,
} from './shift-update-communication.service';
import type {
  ShiftUpdateAssignmentImpactResult,
  ShiftUpdateCommunicationsResult,
  ShiftUpdatePreviewResponse,
} from './dto/shift-update.dto';
import {
  applyShiftUpdatePatch,
  detectShiftCommunicationChanges,
  normalizeShiftCommunicationSnapshot,
  validateShiftUpdateCommunicationsInput,
} from './shift-update-changes.util';
import { assertAssignedStaffCompatibleWithRoleChange } from './shift-update-role-validation.util';
import {
  assertAssignmentResolutionForUpdate,
  evaluateAssigneeImpactForProposedUpdate,
  hasScheduleChange,
  requiresAssigneeRevalidation,
} from './shift-update-assignee-impact.util';
import {
  assertShiftCentreMatchesBatch,
  lockOpenShiftBatch,
} from '../shift-batches/shift-batch-centre.util';
import { normalizeShiftConfirmationNotes } from './shift-confirmation-notes.util';
import { resolveShiftCommunicationPolicyFromRow } from './shift-communication-policy.util';
import { ShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-communication.service';
import {
  ShiftBatchStalenessService,
  type BatchMaterialChangeKind,
} from '../shift-batches/shift-batch-staleness.service';
import { CentreEmailPreviewService } from '../email/centre-email-preview.service';
import type {
  ShiftCentreEmailPreviewDto,
  ShiftCentreEmailUpdatePreviewDto,
} from '../email/dto/centre-email-preview.dto';

export type CreateShiftOptions = {
  tx?: DbExecutor;
  batchId?: string;
};

const assignee = aliasedTable(staff, 'assignee');

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly assignmentConfirmations: ShiftAssignmentConfirmationService,
    private readonly shiftMatching: ShiftMatchingService,
    private readonly shiftReminders: ShiftReminderService,
    private readonly shiftCancellations: ShiftCancellationService,
    private readonly platformAudit: PlatformAuditService,
    private readonly shiftUpdateCommunications: ShiftUpdateCommunicationService,
    private readonly manualUnassignCommunications: ShiftManualUnassignCommunicationService,
    private readonly batchProgressCommunications: ShiftBatchProgressCommunicationService,
    private readonly batchStaleness: ShiftBatchStalenessService,
    private readonly centreEmailPreview: CentreEmailPreviewService,
  ) {}

  list(q: ListShiftsQuery) {
    const conds: SQL[] = [];
    const centreIds = resolveCentreUsageCentreIds({
      centreIds: q.centreIds,
      centreId: q.centreId,
    });
    if (centreIds?.length) {
      conds.push(inArray(shifts.centreId, centreIds));
    }
    if (q.staffId) conds.push(eq(shifts.assignedStaffId, q.staffId));
    if (q.status) conds.push(eq(shifts.status, q.status as never));
    if (q.from) conds.push(gte(shifts.shiftDate, q.from));
    if (q.to) conds.push(lte(shifts.shiftDate, q.to));

    return this.db
      .select({
        id: shifts.id,
        centreId: shifts.centreId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        notes: shifts.notes,
        confirmationNotes: shifts.shiftConfirmationNotes,
        batchId: shifts.batchId,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        cancellationReason: shifts.cancellationReason,
        addedToStaffpoint: shifts.addedToStaffpoint,
        centreName: centres.name,
        assignedLegalName: assignee.legalName,
        assignedDisplayName: assignee.displayName,
        assignedUseDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(shifts.shiftDate));
  }

  async get(id: string) {
    const rows = await this.db
      .select({
        id: shifts.id,
        centreId: shifts.centreId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        notes: shifts.notes,
        confirmationNotes: shifts.shiftConfirmationNotes,
        batchId: shifts.batchId,
        batchRequestCompletedAt: shiftBatches.requestCompletedAt,
        batchPendingChangeRevision: shiftBatches.pendingChangeRevision,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
        cancellationReason: shifts.cancellationReason,
        addedToStaffpoint: shifts.addedToStaffpoint,
        centreName: centres.name,
        assignedLegalName: assignee.legalName,
        assignedDisplayName: assignee.displayName,
        assignedUseDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(centres, eq(centres.id, shifts.centreId))
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .leftJoin(shiftBatches, eq(shifts.batchId, shiftBatches.id))
      .where(eq(shifts.id, id));
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    const policy = resolveShiftCommunicationPolicyFromRow({
      batchId: rows[0].batchId,
      requestCompletedAt: rows[0].batchRequestCompletedAt,
      pendingChangeRevision: rows[0].batchPendingChangeRevision ?? 0,
    });
    return {
      ...rows[0],
      centreCommunicationDeferred: policy.centreCommunicationDeferred,
    };
  }

  async create(dto: UpsertShiftDto, actorUserId: string, options?: CreateShiftOptions) {
    assertActiveShiftRoleForCreate(dto.roleNeeded);
    assertSameDayShiftSchedule(dto.startTime, dto.endTime);

    const run = async (tx: DbExecutor) => {
      const batchId = options?.batchId ?? null;
      if (batchId) {
        const batch = await lockOpenShiftBatch(tx, batchId);
        assertShiftCentreMatchesBatch(dto.centreId, batch.centreId);
      }

      const confirmationNotes = normalizeShiftConfirmationNotes(dto.confirmationNotes);

      const rows = await tx
        .insert(shifts)
        .values({
          centreId: dto.centreId,
          batchId,
          shiftDate: dto.shiftDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          roleNeeded: dto.roleNeeded ?? '',
          notes: dto.notes ?? '',
          shiftConfirmationNotes: confirmationNotes,
          addedToStaffpoint: dto.addedToStaffpoint ?? false,
        })
        .returning({
          id: shifts.id,
          centreId: shifts.centreId,
          shiftDate: shifts.shiftDate,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
        });

      const created = rows[0]!;
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.shiftCreated,
          actorType: 'ops_user',
          actorUserId,
          shiftId: created.id,
          centreId: created.centreId,
          entityId: created.id,
          metadata: {
            shiftDate: String(created.shiftDate),
            startTime: String(created.startTime),
            endTime: String(created.endTime),
            ...(batchId ? { batchId } : {}),
          },
        },
        tx,
      );

      return { id: created.id };
    };

    if (options?.tx) return run(options.tx);
    return this.db.transaction(run);
  }

  async insertInitialComment(
    tx: DbExecutor,
    shiftId: string,
    authorId: string,
    body: string | undefined,
  ) {
    const trimmed = body?.trim() ?? '';
    if (!trimmed) return null;
    const rows = await tx
      .insert(shiftComments)
      .values({ shiftId, authorId, body: trimmed })
      .returning();
    return rows[0] ?? null;
  }

  async previewUpdate(id: string, dto: PreviewUpdateShiftDto): Promise<ShiftUpdatePreviewResponse> {
    const before = await this.loadShiftUpdateBefore(id);
    const beforeSnapshot = normalizeShiftCommunicationSnapshot(before);
    const afterSnapshot = applyShiftUpdatePatch(beforeSnapshot, {
      shiftDate: dto.shiftDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      roleNeeded: dto.roleNeeded,
    });

    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      assertSameDayShiftSchedule(afterSnapshot.startTime, afterSnapshot.endTime);
    }

    const relevantChanges = detectShiftCommunicationChanges(beforeSnapshot, afterSnapshot);

    let assigneeImpact = null;
    if (
      before.assignedStaffId &&
      before.status === 'filled' &&
      requiresAssigneeRevalidation(beforeSnapshot, afterSnapshot)
    ) {
      const staffName = await this.loadStaffLegalName(before.assignedStaffId);
      assigneeImpact = await evaluateAssigneeImpactForProposedUpdate({
        shiftMatching: this.shiftMatching,
        shiftId: id,
        assignedStaffId: before.assignedStaffId,
        staffName,
        before: beforeSnapshot,
        proposed: {
          shiftDate: afterSnapshot.shiftDate,
          startTime: afterSnapshot.startTime,
          endTime: afterSnapshot.endTime,
          roleNeeded: afterSnapshot.roleNeeded,
        },
      });
    }

    return {
      relevantChanges,
      assigneeImpact,
      requiresAssignmentResolution:
        assigneeImpact !== null && assigneeImpact.status !== 'eligible',
    };
  }

  async update(id: string, dto: UpdateShiftDto, actorUserId: string) {
    const before = await this.loadShiftUpdateBefore(id);

    assertShiftRoleUpdateAllowed(before.roleNeeded, dto.roleNeeded);

    const beforeSnapshot = normalizeShiftCommunicationSnapshot(before);
    const normalizedConfirmationNotes =
      dto.confirmationNotes !== undefined
        ? (normalizeShiftConfirmationNotes(dto.confirmationNotes) ?? '')
        : undefined;
    const afterSnapshot = applyShiftUpdatePatch(beforeSnapshot, {
      shiftDate: dto.shiftDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      roleNeeded: dto.roleNeeded,
      confirmationNotes: normalizedConfirmationNotes,
    });

    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      assertSameDayShiftSchedule(afterSnapshot.startTime, afterSnapshot.endTime);
    }

    const communicationChanges = detectShiftCommunicationChanges(beforeSnapshot, afterSnapshot);

    const previousAssignedStaffId = before.assignedStaffId;
    const assignmentResolution = await assertAssignmentResolutionForUpdate({
      shiftMatching: this.shiftMatching,
      shiftId: id,
      assignedStaffId: before.assignedStaffId ?? '',
      status: before.status,
      before: beforeSnapshot,
      after: afterSnapshot,
      assignmentResolution: dto.assignmentResolution,
    });

    const shouldUnassign = assignmentResolution.shouldUnassign;
    const availabilityOverride = assignmentResolution.availabilityOverride;

    if (
      before.assignedStaffId &&
      communicationChanges.some((change) => change.field === 'role') &&
      !shouldUnassign
    ) {
      await assertAssignedStaffCompatibleWithRoleChange({
        shiftMatching: this.shiftMatching,
        shiftId: id,
        assignedStaffId: before.assignedStaffId,
        before: beforeSnapshot,
        after: afterSnapshot,
      });
    }

    const communicationSelections = validateShiftUpdateCommunicationsInput({
      changes: communicationChanges,
      communications: dto.communications,
      assignmentUnassigned: shouldUnassign,
    });
    if (communicationSelections) {
      assertShiftUpdateCommunicationsSelection({
        changes: communicationChanges,
        selections: communicationSelections,
      });
    }

    if (dto.centreId !== undefined && dto.centreId !== before.centreId) {
      if (before.batchId) {
        throw new BadRequestException('Cannot change centre for a shift that belongs to a batch.');
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      'shiftDate',
      'startTime',
      'endTime',
      'centreId',
      'roleNeeded',
      'notes',
      'addedToStaffpoint',
    ] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key];
    }
    if (dto.confirmationNotes !== undefined) {
      patch.shiftConfirmationNotes = normalizeShiftConfirmationNotes(dto.confirmationNotes);
    }

    if (shouldUnassign) {
      patch.assignedStaffId = null;
      patch.status = 'pending';
    }

    const scheduleChanged = hasScheduleChange(beforeSnapshot, afterSnapshot);

    let scheduledReminderIds: string[] = [];
    const row = await this.db.transaction(async (tx) => {
      const rows = await tx.update(shifts).set(patch).where(eq(shifts.id, id)).returning();
      if (!rows[0]) throw new NotFoundException('Shift not found.');

      if (shouldUnassign) {
        await this.shiftReminders.cancelPendingForShift(id, tx);
      }

      const metadata = buildShiftUpdateMetadata(
        shiftAuditSnapshot(before),
        shiftAuditSnapshot(rows[0]!),
      );
      if (metadata) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftUpdated,
            actorType: 'ops_user',
            actorUserId,
            shiftId: id,
            centreId: rows[0].centreId,
            staffId: rows[0].assignedStaffId,
            entityId: id,
            metadata,
          },
          tx,
        );
      }

      if (shouldUnassign && previousAssignedStaffId) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange,
            actorType: 'ops_user',
            actorUserId,
            shiftId: id,
            centreId: rows[0].centreId,
            staffId: previousAssignedStaffId,
            entityId: id,
            metadata: {
              previousStaffId: previousAssignedStaffId,
              eligibilityReasons: assignmentResolution.impact?.reasons ?? [],
              shiftDate: String(rows[0].shiftDate),
              startTime: String(rows[0].startTime),
              endTime: String(rows[0].endTime),
            },
          },
          tx,
        );
      }

      if (availabilityOverride && previousAssignedStaffId) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftAvailabilityOverrideConfirmed,
            actorType: 'ops_user',
            actorUserId,
            shiftId: id,
            centreId: rows[0].centreId,
            staffId: previousAssignedStaffId,
            entityId: id,
            metadata: {
              assignedStaffId: previousAssignedStaffId,
              shiftDate: String(rows[0].shiftDate),
              startTime: String(rows[0].startTime),
              endTime: String(rows[0].endTime),
            },
          },
          tx,
        );
      }

      if (
        scheduleChanged &&
        rows[0].status === 'filled' &&
        rows[0].assignedStaffId
      ) {
        scheduledReminderIds = await this.shiftReminders.rescheduleFilledShift(
          {
            shiftId: id,
            assignedStaffId: rows[0].assignedStaffId!,
            shiftDate: String(rows[0].shiftDate),
            startTime: String(rows[0].startTime),
          },
          tx,
        );
      }

      return rows[0];
    });

    if (scheduledReminderIds.length > 0) {
      await this.shiftReminders.enqueueScheduledIds(scheduledReminderIds);
    }

    let communications: ShiftUpdateCommunicationsResult = null;
    if (communicationSelections) {
      communications = await this.shiftUpdateCommunications.sendCommunications({
        shiftId: id,
        centreId: row.centreId,
        assignedStaffId: row.assignedStaffId,
        actorUserId,
        changes: communicationChanges,
        selections: communicationSelections,
        assignmentUnassigned: shouldUnassign,
        previousAssignedStaffId,
        centreEmail: dto.centreEmail,
      });
    }

    const assignmentImpact: ShiftUpdateAssignmentImpactResult = shouldUnassign
      ? { action: 'unassigned', previousStaffId: previousAssignedStaffId }
      : availabilityOverride
        ? { action: 'availability_override', previousStaffId: previousAssignedStaffId }
        : { action: 'unchanged' };

    if (shouldUnassign && before.batchId) {
      await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(before.batchId);
    }

    if (before.batchId && (communicationChanges.length > 0 || shouldUnassign)) {
      await this.batchStaleness.recordMaterialChange(
        before.batchId,
        shouldUnassign ? 'unassign' : this.materialChangeKindFromUpdates(communicationChanges),
      );
    }

    return { ...row, communications, assignmentImpact };
  }

  private materialChangeKindFromUpdates(
    changes: ReturnType<typeof detectShiftCommunicationChanges>,
  ): BatchMaterialChangeKind {
    if (changes.some((change) => change.field === 'role')) return 'role';
    if (changes.some((change) => change.field === 'shiftNotes')) return 'shift_notes';
    if (changes.some((change) => change.field === 'date')) return 'schedule';
    return 'schedule';
  }

  private async loadShiftUpdateBefore(id: string) {
    const before = await this.db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        centreId: shifts.centreId,
        batchId: shifts.batchId,
        roleNeeded: shifts.roleNeeded,
        notes: shifts.notes,
        shiftConfirmationNotes: shifts.shiftConfirmationNotes,
        addedToStaffpoint: shifts.addedToStaffpoint,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
      })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!before[0]) throw new NotFoundException('Shift not found.');
    return before[0];
  }

  private async loadStaffLegalName(staffId: string): Promise<string> {
    const rows = await this.db
      .select({
        legalName: staff.legalName,
        legalFirstName: staff.legalFirstName,
        legalLastName: staff.legalLastName,
      })
      .from(staff)
      .where(eq(staff.id, staffId));
    const row = rows[0];
    if (!row) return 'Staff member';
    return (
      getStaffLegalFullName({
        legalFirstName: row.legalFirstName,
        legalLastName: row.legalLastName,
        legalName: row.legalName,
      }) || 'Staff member'
    );
  }

  async remove(id: string) {
    await this.shiftReminders.cancelPendingForShift(id);
    await this.db.delete(shifts).where(eq(shifts.id, id));
    return { ok: true };
  }

  async assign(
    id: string,
    staffId: string,
    actorUserId: string,
    options?: { notifyPreviousCarer?: boolean; centreEmail?: { subject?: string; message?: string } },
  ): Promise<ShiftAssignResponse> {
    const existing = await this.db
      .select({
        assignedStaffId: shifts.assignedStaffId,
        shiftDate: shifts.shiftDate,
        centreId: shifts.centreId,
      })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!existing[0]) throw new NotFoundException('Shift not found.');
    if (existing[0].assignedStaffId === staffId) {
      const shift = await this.get(id);
      return {
        shift,
        assignment: { changed: false, alreadyAssigned: true },
        notifications: null,
      };
    }

    let previousStaffId: string | null = null;
    let assignmentChanged = false;
    let scheduledReminderIds: string[] = [];

    await this.db.transaction(async (tx) => {
      await acquireShiftStaffDateAdvisoryLock(tx, staffId, existing[0].shiftDate);

      const locked = await tx
        .select({
          assignedStaffId: shifts.assignedStaffId,
          centreId: shifts.centreId,
          batchId: shifts.batchId,
        })
        .from(shifts)
        .where(eq(shifts.id, id))
        .for('update');
      if (!locked[0]) throw new NotFoundException('Shift not found.');
      if (locked[0].assignedStaffId === staffId) return;

      const authoritativePreviousStaffId = locked[0].assignedStaffId;

      const eligibility = await this.shiftMatching.evaluateStaffForShift(id, staffId, tx);
      if (!eligibility.eligible) {
        throw new ConflictException({
          message: SHIFT_ASSIGN_INELIGIBLE_MESSAGE,
          reasons: eligibility.reasons,
        });
      }

      const contactedRows = await tx
        .select({ shiftId: shiftContacted.shiftId })
        .from(shiftContacted)
        .where(and(eq(shiftContacted.shiftId, id), eq(shiftContacted.staffId, staffId)))
        .limit(1);
      if (!contactedRows[0]) {
        throw new ConflictException({
          message: 'Carer must be marked as Contacted before assignment.',
          code: 'carer_not_contacted',
        });
      }

      if (locked[0].batchId) {
        const batchRows = await tx
          .select({ cancelledAt: shiftBatches.cancelledAt })
          .from(shiftBatches)
          .where(eq(shiftBatches.id, locked[0].batchId))
          .limit(1);
        if (batchRows[0]?.cancelledAt) {
          throw new ConflictException({
            message: 'This Batch Request has been cancelled.',
            code: 'batch_cancelled',
          });
        }
      }

      await this.shiftReminders.cancelPendingForShift(id, tx);

      const updated = await tx
        .update(shifts)
        .set({ assignedStaffId: staffId, status: 'filled', updatedAt: new Date() })
        .where(and(eq(shifts.id, id), sql`${shifts.assignedStaffId} IS DISTINCT FROM ${staffId}`))
        .returning({ id: shifts.id, shiftDate: shifts.shiftDate, startTime: shifts.startTime, centreId: shifts.centreId });

      if (updated[0]) {
        assignmentChanged = true;
        previousStaffId = authoritativePreviousStaffId;
        const action = assignmentAuditAction(authoritativePreviousStaffId, staffId);
        if (action) {
          await this.platformAudit.record(
            {
              action,
              actorType: 'ops_user',
              actorUserId,
              shiftId: id,
              centreId: updated[0].centreId,
              staffId,
              entityId: id,
              metadata: {
                previousStaffId: authoritativePreviousStaffId ?? undefined,
                newStaffId: staffId,
                assignedStaffId: staffId,
                shiftDate: String(updated[0].shiftDate),
              },
            },
            tx,
          );
        }

        scheduledReminderIds = await this.shiftReminders.scheduleForFilledShift(
          {
            shiftId: id,
            assignedStaffId: staffId,
            shiftDate: String(updated[0].shiftDate),
            startTime: String(updated[0].startTime),
          },
          tx,
        );
      }
    });

    if (!assignmentChanged) {
      const shift = await this.get(id);
      return {
        shift,
        assignment: { changed: false, alreadyAssigned: true },
        notifications: null,
      };
    }

    const shift = await this.get(id);
    const notifications = await this.assignmentConfirmations.sendAssignmentConfirmations({
      shiftId: id,
      assignedStaffId: staffId,
      actorUserId,
      trigger: 'assign',
      centreEmail: options?.centreEmail,
    });

    let previousCarerNotification: ShiftAssignResponse['previousCarerNotification'] = null;
    if (
      previousStaffId &&
      previousStaffId !== staffId &&
      options?.notifyPreviousCarer === true
    ) {
      const unassignResult = await this.manualUnassignCommunications.sendCommunications({
        shiftId: id,
        centreId: shift.centreId,
        previousStaffId,
        actorUserId,
        recipients: { centre: false, carer: true },
      });
      previousCarerNotification = unassignResult.carer;
    }

    await this.shiftReminders.enqueueScheduledIds(scheduledReminderIds);
    await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(shift.batchId);
    if (shift.batchId) {
      await this.batchStaleness.recordMaterialChange(shift.batchId, 'assignment', {
        shiftId: id,
        previousStaffId: previousStaffId ?? undefined,
        newStaffId: staffId,
      });
    }
    return {
      shift,
      assignment: { changed: true, alreadyAssigned: false },
      notifications,
      previousCarerNotification,
    };
  }

  async sendAssignmentConfirmation(
    id: string,
    actorUserId: string,
    dto: ResendConfirmationDto,
  ): Promise<ShiftResendConfirmationsResponse> {
    const row = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!row[0]) throw new NotFoundException('Shift not found.');
    if (!row[0].assignedStaffId) {
      throw new NotFoundException('Shift has no assigned staff member.');
    }
    if (row[0].status !== 'filled') {
      throw new NotFoundException('Shift is not in a resendable assigned state.');
    }

    const recipients = resolveSelectedRecipients(dto.recipients);
    if (!recipients.centre && !recipients.carer) {
      throw new BadRequestException('At least one recipient must be selected.');
    }

    const notifications = await this.assignmentConfirmations.sendAssignmentConfirmations({
      shiftId: id,
      assignedStaffId: row[0].assignedStaffId,
      actorUserId,
      trigger: 'resend',
      recipients,
      centreEmail: dto.centreEmail,
    });
    return { notifications };
  }

  async previewCentreAssignmentEmail(id: string, dto: ShiftCentreEmailPreviewDto) {
    return this.centreEmailPreview.previewAssignmentConfirmation({
      shiftId: id,
      staffId: dto.staffId,
      custom: dto.centreEmail,
    });
  }

  async previewCentreUpdateEmail(id: string, dto: ShiftCentreEmailUpdatePreviewDto) {
    const before = await this.loadShiftUpdateBefore(id);
    const beforeSnapshot = normalizeShiftCommunicationSnapshot(before);
    const afterSnapshot = applyShiftUpdatePatch(beforeSnapshot, {
      shiftDate: dto.shiftDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      roleNeeded: dto.roleNeeded,
    });
    const changes = detectShiftCommunicationChanges(beforeSnapshot, afterSnapshot);
    const includedChanges =
      dto.includedChangeFields != null
        ? changes.filter((change) => dto.includedChangeFields!.includes(change.field))
        : changes;
    return this.centreEmailPreview.previewShiftUpdateConfirmation({
      shiftId: id,
      includedChanges,
      custom: dto.centreEmail,
    });
  }

  async assignmentConfirmationRecipientAvailability(id: string, actorUserId: string) {
    const row = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!row[0]) throw new NotFoundException('Shift not found.');
    if (!row[0].assignedStaffId) {
      throw new NotFoundException('Shift has no assigned staff member.');
    }
    if (row[0].status !== 'filled') {
      throw new NotFoundException('Shift is not in a resendable assigned state.');
    }

    return this.assignmentConfirmations.resolveRecipientAvailability({
      shiftId: id,
      assignedStaffId: row[0].assignedStaffId,
      actorUserId,
    });
  }

  async unassign(id: string, actorUserId: string, dto?: UnassignShiftDto): Promise<UnassignShiftResponse> {
    const existing = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, centreId: shifts.centreId })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!existing[0]) throw new NotFoundException('Shift not found.');
    if (!existing[0].assignedStaffId) {
      throw new BadRequestException('Shift has no assigned staff member to unassign.');
    }

    const previousStaffId = existing[0].assignedStaffId;
    const commRecipients = resolveSelectedRecipients(dto?.communications);
    const sendComms = commRecipients.centre || commRecipients.carer;

    const row = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(shifts)
        .set({ assignedStaffId: null, status: 'pending', updatedAt: new Date() })
        .where(eq(shifts.id, id))
        .returning();
      if (!rows[0]) throw new NotFoundException('Shift not found.');

      await this.shiftReminders.cancelPendingForShift(id, tx);

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.shiftUnassigned,
          actorType: 'ops_user',
          actorUserId,
          shiftId: id,
          centreId: rows[0].centreId,
          staffId: previousStaffId,
          entityId: id,
          metadata: {
            previousStaffId,
          },
        },
        tx,
      );

      return rows[0];
    });

    let notifications = null;
    if (sendComms) {
      notifications = await this.manualUnassignCommunications.sendCommunications({
        shiftId: id,
        centreId: row.centreId,
        previousStaffId,
        actorUserId,
        recipients: commRecipients,
      });
    }

    await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(row.batchId);
    if (row.batchId) {
      await this.batchStaleness.recordMaterialChange(row.batchId, 'unassign', { shiftId: id });
    }

    return { shift: row, notifications };
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actorUserId: string) {
    if (dto.status === 'cancelled') {
      return this.transitionToCancelled(
        id,
        dto.cancellationReason,
        actorUserId,
        dto.communications,
      );
    }

    if (dto.status === 'pending') {
      rejectGenericPendingTransition();
    }

    if (dto.status === 'completed') {
      await this.shiftReminders.cancelPendingForShift(id);
    }

    const existing = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, centreId: shifts.centreId, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!existing[0]) throw new NotFoundException('Shift not found.');

    if (dto.status === 'completed') {
      assertManualCompletionAllowed(existing[0].status);
    }

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(shifts)
        .set({ status: dto.status, updatedAt: new Date() })
        .where(eq(shifts.id, id))
        .returning();
      if (!rows[0]) throw new NotFoundException('Shift not found.');

      if (dto.status === 'completed') {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftCompletedManual,
            actorType: 'ops_user',
            actorUserId,
            shiftId: id,
            centreId: rows[0].centreId,
            staffId: rows[0].assignedStaffId,
            entityId: id,
          },
          tx,
        );
      }

      return rows[0];
    });
  }

  private async transitionToCancelled(
    id: string,
    cancellationReason: string | undefined,
    actorUserId: string,
    communications?: ShiftCommunicationRecipientsDto,
  ) {
    let scheduledCancellationIds: string[] = [];
    const commRecipients = resolveSelectedRecipients(communications);

    const row = await this.db.transaction(async (tx) => {
      const locked = await tx
        .select({
          id: shifts.id,
          status: shifts.status,
          assignedStaffId: shifts.assignedStaffId,
          centreId: shifts.centreId,
          batchId: shifts.batchId,
        })
        .from(shifts)
        .where(eq(shifts.id, id))
        .for('update');

      if (!locked[0]) throw new NotFoundException('Shift not found.');

      let requestCompletedAt: Date | null = null;
      if (locked[0].batchId) {
        const batchRows = await tx
          .select({ requestCompletedAt: shiftBatches.requestCompletedAt })
          .from(shiftBatches)
          .where(eq(shiftBatches.id, locked[0].batchId))
          .limit(1);
        requestCompletedAt = batchRows[0]?.requestCompletedAt ?? null;
      }

      if (locked[0].status === 'cancelled') {
        const existing = await tx.select().from(shifts).where(eq(shifts.id, id)).limit(1);
        return existing[0]!;
      }

      const trimmedReason = normalizeRequiredCancellationReason(cancellationReason);

      const patch: Record<string, unknown> = {
        status: 'cancelled',
        updatedAt: new Date(),
        cancellationReason: trimmedReason,
      };

      const updated = await tx
        .update(shifts)
        .set(patch)
        .where(eq(shifts.id, id))
        .returning();

      const cancelled = updated[0];
      if (!cancelled) throw new NotFoundException('Shift not found.');

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.shiftCancelled,
          actorType: 'ops_user',
          actorUserId,
          shiftId: id,
          centreId: cancelled.centreId,
          staffId: cancelled.assignedStaffId,
          entityId: id,
          metadata: {
            cancellationReasonPreview: cancellationReasonPreview(trimmedReason),
          },
        },
        tx,
      );

      await this.shiftReminders.cancelPendingForShift(id, tx);

      const batchPolicy = resolveShiftCommunicationPolicyFromRow({
        batchId: locked[0].batchId,
        requestCompletedAt,
      });
      const effectiveRecipients = {
        centre: commRecipients.centre && !batchPolicy.centreCommunicationDeferred,
        carer: commRecipients.carer && !!cancelled.assignedStaffId,
      };

      if (effectiveRecipients.centre || effectiveRecipients.carer) {
        scheduledCancellationIds = await this.shiftCancellations.scheduleCancellation(
          {
            shiftId: id,
            assignedStaffId: cancelled.assignedStaffId,
            centreId: cancelled.centreId,
            scheduledFor: cancelled.updatedAt,
            recipients: effectiveRecipients,
          },
          tx,
        );
      }

      return cancelled;
    });

    if (scheduledCancellationIds.length > 0) {
      await this.shiftCancellations.enqueueScheduledIds(scheduledCancellationIds);
    }

    await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(row.batchId);
    if (row.batchId) {
      await this.batchStaleness.recordMaterialChange(row.batchId, 'cancellation', { shiftId: id });
    }

    return row;
  }

  /** Authoritative smart-matched eligible staff for a shift (top/contacted annotated). */
  async availableStaff(shiftId: string) {
    return this.shiftMatching.findEligibleStaffForShift(shiftId);
  }

  async setContacted(shiftId: string, staffId: string, contacted: boolean) {
    if (contacted) {
      await this.db
        .insert(shiftContacted)
        .values({ shiftId, staffId })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(shiftContacted)
        .where(and(eq(shiftContacted.shiftId, shiftId), eq(shiftContacted.staffId, staffId)));
    }
    return { ok: true };
  }

  // --- Comments (author from session — closes M1) -------------------------
  comments(shiftId: string) {
    return this.db
      .select({
        id: shiftComments.id,
        shiftId: shiftComments.shiftId,
        authorId: shiftComments.authorId,
        authorName: users.fullName,
        authorEmail: users.email,
        body: shiftComments.body,
        createdAt: shiftComments.createdAt,
      })
      .from(shiftComments)
      .leftJoin(users, eq(users.id, shiftComments.authorId))
      .where(eq(shiftComments.shiftId, shiftId))
      .orderBy(desc(shiftComments.createdAt));
  }

  async addComment(shiftId: string, authorId: string, dto: AddCommentDto) {
    await this.get(shiftId);
    const rows = await this.db
      .insert(shiftComments)
      .values({ shiftId, authorId, body: dto.body })
      .returning();
    return rows[0];
  }

  async deleteComment(commentId: string, requesterId: string, requesterRole: string) {
    const rows = await this.db
      .select()
      .from(shiftComments)
      .where(eq(shiftComments.id, commentId));
    const comment = rows[0];
    if (!comment) throw new NotFoundException('Comment not found.');
    if (comment.authorId !== requesterId && requesterRole !== 'admin') {
      throw new ForbiddenException('You can only delete your own comments.');
    }
    await this.db.delete(shiftComments).where(eq(shiftComments.id, commentId));
    return { ok: true };
  }

  // Cron target: complete filled shifts whose end datetime has passed.
  async autoCompletePastShifts(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const result = await tx
        .update(shifts)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(
          and(
            eq(shifts.status, 'filled'),
            sql`(${shifts.shiftDate} + ${shifts.endTime}) <= now()`,
          ),
        )
        .returning({
          id: shifts.id,
          centreId: shifts.centreId,
          assignedStaffId: shifts.assignedStaffId,
        });

      for (const row of result) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftCompletedAuto,
            actorType: 'system',
            shiftId: row.id,
            centreId: row.centreId,
            staffId: row.assignedStaffId,
            entityId: row.id,
          },
          tx,
        );
        await this.shiftReminders.cancelPendingForShift(row.id, tx);
      }

      return result.length;
    });
  }
}
