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
import { acquireShiftStaffDateAdvisoryLock } from './shift-staff-date-advisory-lock.util';
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
        actualStartTime: shifts.actualStartTime,
        actualEndTime: shifts.actualEndTime,
        actualTotalMinutes: shifts.actualTotalMinutes,
        currentHoursSource: shifts.currentHoursSource,
        hoursFinalizedAt: shifts.hoursFinalizedAt,
        currentHoursAdjustmentId: shifts.currentHoursAdjustmentId,
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
        actualStartTime: shifts.actualStartTime,
        actualEndTime: shifts.actualEndTime,
        actualTotalMinutes: shifts.actualTotalMinutes,
        currentHoursSource: shifts.currentHoursSource,
        hoursFinalizedAt: shifts.hoursFinalizedAt,
        currentHoursAdjustmentId: shifts.currentHoursAdjustmentId,
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

  async create(dto: UpsertShiftDto) {
    const rows = await this.db
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
      .returning({ id: shifts.id });
    return rows[0];
  }

  async update(id: string, dto: UpdateShiftDto) {
    const before = await this.db
      .select({
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        status: shifts.status,
        assignedStaffId: shifts.assignedStaffId,
      })
      .from(shifts)
      .where(eq(shifts.id, id));
    if (!before[0]) throw new NotFoundException('Shift not found.');

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
    const rows = await this.db.update(shifts).set(patch).where(eq(shifts.id, id)).returning();
    if (!rows[0]) throw new NotFoundException('Shift not found.');

    const scheduleChanged =
      (dto.shiftDate !== undefined && dto.shiftDate !== String(before[0].shiftDate)) ||
      (dto.startTime !== undefined && dto.startTime !== String(before[0].startTime));

    let scheduledReminderIds: string[] = [];
    if (
      scheduleChanged &&
      rows[0].status === 'filled' &&
      rows[0].assignedStaffId
    ) {
      await this.db.transaction(async (tx) => {
        scheduledReminderIds = await this.shiftReminders.rescheduleFilledShift(
          {
            shiftId: id,
            assignedStaffId: rows[0].assignedStaffId!,
            shiftDate: String(rows[0].shiftDate),
            startTime: String(rows[0].startTime),
          },
          tx,
        );
      });
      await this.shiftReminders.enqueueScheduledIds(scheduledReminderIds);
    }

    return rows[0];
  }

  async remove(id: string) {
    await this.shiftReminders.cancelPendingForShift(id);
    await this.db.delete(shifts).where(eq(shifts.id, id));
    return { ok: true };
  }

  async assign(id: string, staffId: string, actorUserId: string): Promise<ShiftAssignResponse> {
    const existing = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId, shiftDate: shifts.shiftDate })
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

    let assignmentChanged = false;
    let scheduledReminderIds: string[] = [];

    await this.db.transaction(async (tx) => {
      await acquireShiftStaffDateAdvisoryLock(tx, staffId, existing[0].shiftDate);

      const locked = await tx
        .select({ assignedStaffId: shifts.assignedStaffId })
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
        .returning({ id: shifts.id, shiftDate: shifts.shiftDate, startTime: shifts.startTime });

      if (updated[0]) {
        assignmentChanged = true;
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

  async unassign(id: string) {
    await this.shiftReminders.cancelPendingForShift(id);
    const rows = await this.db
      .update(shifts)
      .set({ assignedStaffId: null, status: 'pending', updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    if (dto.status === 'cancelled') {
      return this.transitionToCancelled(id, dto.cancellationReason);
    }

    if (dto.status === 'completed' || dto.status === 'pending') {
      await this.shiftReminders.cancelPendingForShift(id);
    }

    const patch: Record<string, unknown> = { status: dto.status, updatedAt: new Date() };
    if (dto.status === 'pending') patch.assignedStaffId = null;
    const rows = await this.db.update(shifts).set(patch).where(eq(shifts.id, id)).returning();
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  private async transitionToCancelled(id: string, cancellationReason?: string) {
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

      const patch: Record<string, unknown> = {
        status: 'cancelled',
        updatedAt: new Date(),
      };
      if (cancellationReason !== undefined) {
        patch.cancellationReason = cancellationReason;
      }

      const updated = await tx
        .update(shifts)
        .set(patch)
        .where(eq(shifts.id, id))
        .returning();

      const cancelled = updated[0];
      if (!cancelled) throw new NotFoundException('Shift not found.');

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
    const result = await this.db
      .update(shifts)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(
        and(
          eq(shifts.status, 'filled'),
          sql`(${shifts.shiftDate} + ${shifts.endTime}) <= now()`,
        ),
      )
      .returning({ id: shifts.id });
    for (const row of result) {
      await this.shiftReminders.cancelPendingForShift(row.id);
    }
    return result.length;
  }
}
