import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { aliasedTable, and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centres,
  shiftComments,
  shiftContacted,
  shifts,
  staff,
  users,
} from '../db/schema';
import type { ShiftAssignResponse, ShiftResendConfirmationsResponse } from './dto/shift-assignment.dto';
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
import {
  AddCommentDto,
  ChangeStatusDto,
  ListShiftsQuery,
  UpdateShiftDto,
  UpsertShiftDto,
} from './dto/shifts.dto';

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
  ) {}

  list(q: ListShiftsQuery) {
    const conds: SQL[] = [];
    if (q.centreId) conds.push(eq(shifts.centreId, q.centreId));
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
      .where(eq(shifts.id, id));
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  async create(dto: UpsertShiftDto, actorUserId: string) {
    assertSameDayShiftSchedule(dto.startTime, dto.endTime);

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(shifts)
        .values({
          centreId: dto.centreId,
          shiftDate: dto.shiftDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          roleNeeded: dto.roleNeeded ?? '',
          notes: dto.notes ?? '',
          addedToStaffpoint: dto.addedToStaffpoint ?? false,
        })
        .returning({ id: shifts.id, centreId: shifts.centreId, shiftDate: shifts.shiftDate, startTime: shifts.startTime, endTime: shifts.endTime });

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
          },
        },
        tx,
      );

      return { id: created.id };
    });
  }

  async update(id: string, dto: UpdateShiftDto, actorUserId: string) {
    const before = await this.db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        centreId: shifts.centreId,
        roleNeeded: shifts.roleNeeded,
        notes: shifts.notes,
        addedToStaffpoint: shifts.addedToStaffpoint,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
      })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!before[0]) throw new NotFoundException('Shift not found.');

    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      assertSameDayShiftSchedule(
        dto.startTime ?? String(before[0].startTime),
        dto.endTime ?? String(before[0].endTime),
      );
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

    let scheduledReminderIds: string[] = [];
    const row = await this.db.transaction(async (tx) => {
      const rows = await tx.update(shifts).set(patch).where(eq(shifts.id, id)).returning();
      if (!rows[0]) throw new NotFoundException('Shift not found.');

      const metadata = buildShiftUpdateMetadata(
        shiftAuditSnapshot(before[0]!),
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

      const scheduleChanged =
        (dto.shiftDate !== undefined && dto.shiftDate !== String(before[0].shiftDate)) ||
        (dto.startTime !== undefined && dto.startTime !== String(before[0].startTime));

      if (scheduleChanged && rows[0].status === 'filled' && rows[0].assignedStaffId) {
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

    return row;
  }

  async remove(id: string) {
    await this.shiftReminders.cancelPendingForShift(id);
    await this.db.delete(shifts).where(eq(shifts.id, id));
    return { ok: true };
  }

  async assign(id: string, staffId: string, actorUserId: string): Promise<ShiftAssignResponse> {
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

    const previousStaffId = existing[0].assignedStaffId;
    let assignmentChanged = false;
    let scheduledReminderIds: string[] = [];

    await this.db.transaction(async (tx) => {
      await acquireShiftStaffDateAdvisoryLock(tx, staffId, existing[0].shiftDate);

      const locked = await tx
        .select({ assignedStaffId: shifts.assignedStaffId, centreId: shifts.centreId })
        .from(shifts)
        .where(eq(shifts.id, id))
        .for('update');
      if (!locked[0]) throw new NotFoundException('Shift not found.');
      if (locked[0].assignedStaffId === staffId) return;

      const eligibility = await this.shiftMatching.evaluateStaffForShift(id, staffId, tx);
      if (!eligibility.eligible) {
        throw new ConflictException({
          message: SHIFT_ASSIGN_INELIGIBLE_MESSAGE,
          reasons: eligibility.reasons,
        });
      }

      await this.shiftReminders.cancelPendingForShift(id, tx);

      const updated = await tx
        .update(shifts)
        .set({ assignedStaffId: staffId, status: 'filled', updatedAt: new Date() })
        .where(and(eq(shifts.id, id), sql`${shifts.assignedStaffId} IS DISTINCT FROM ${staffId}`))
        .returning({ id: shifts.id, shiftDate: shifts.shiftDate, startTime: shifts.startTime, centreId: shifts.centreId });

      if (updated[0]) {
        assignmentChanged = true;
        const action = assignmentAuditAction(previousStaffId, staffId);
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
                previousStaffId: previousStaffId ?? undefined,
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
    });
    await this.shiftReminders.enqueueScheduledIds(scheduledReminderIds);
    return {
      shift,
      assignment: { changed: true, alreadyAssigned: false },
      notifications,
    };
  }

  async sendAssignmentConfirmation(
    id: string,
    actorUserId: string,
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

    const notifications = await this.assignmentConfirmations.sendAssignmentConfirmations({
      shiftId: id,
      assignedStaffId: row[0].assignedStaffId,
      actorUserId,
      trigger: 'resend',
    });
    return { notifications };
  }

  async unassign(id: string, actorUserId: string) {
    const existing = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, centreId: shifts.centreId })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!existing[0]) throw new NotFoundException('Shift not found.');

    await this.shiftReminders.cancelPendingForShift(id);

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(shifts)
        .set({ assignedStaffId: null, status: 'pending', updatedAt: new Date() })
        .where(eq(shifts.id, id))
        .returning();
      if (!rows[0]) throw new NotFoundException('Shift not found.');

      if (existing[0].assignedStaffId) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.shiftUnassigned,
            actorType: 'ops_user',
            actorUserId,
            shiftId: id,
            centreId: rows[0].centreId,
            staffId: existing[0].assignedStaffId,
            entityId: id,
            metadata: {
              previousStaffId: existing[0].assignedStaffId,
            },
          },
          tx,
        );
      }

      return rows[0];
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actorUserId: string) {
    if (dto.status === 'cancelled') {
      return this.transitionToCancelled(id, dto.cancellationReason, actorUserId);
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
  ) {
    let scheduledCancellationIds: string[] = [];

    const row = await this.db.transaction(async (tx) => {
      const locked = await tx
        .select({
          id: shifts.id,
          status: shifts.status,
          assignedStaffId: shifts.assignedStaffId,
          centreId: shifts.centreId,
        })
        .from(shifts)
        .where(eq(shifts.id, id))
        .for('update');

      if (!locked[0]) throw new NotFoundException('Shift not found.');
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

      if (cancelled.assignedStaffId) {
        scheduledCancellationIds = await this.shiftCancellations.scheduleForAssignedCancellation(
          {
            shiftId: id,
            assignedStaffId: cancelled.assignedStaffId,
            centreId: cancelled.centreId,
            scheduledFor: cancelled.updatedAt,
          },
          tx,
        );
      }

      return cancelled;
    });

    if (scheduledCancellationIds.length > 0) {
      await this.shiftCancellations.enqueueScheduledIds(scheduledCancellationIds);
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
