import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { aliasedTable, and, asc, desc, eq, gte, lte, ne, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centres,
  shiftComments,
  shiftContacted,
  shifts,
  staff,
  staffCentreBanned,
  staffCentreTop,
  users,
} from '../db/schema';
import type { ShiftAssignResponse, ShiftResendConfirmationsResponse } from './dto/shift-assignment.dto';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
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
    return rows[0];
  }

  async remove(id: string) {
    await this.db.delete(shifts).where(eq(shifts.id, id));
    return { ok: true };
  }

  async assign(id: string, staffId: string, actorUserId: string): Promise<ShiftAssignResponse> {
    const updated = await this.db
      .update(shifts)
      .set({ assignedStaffId: staffId, status: 'filled', updatedAt: new Date() })
      .where(and(eq(shifts.id, id), sql`${shifts.assignedStaffId} IS DISTINCT FROM ${staffId}`))
      .returning();

    if (updated[0]) {
      const shift = await this.get(id);
      const notifications = await this.assignmentConfirmations.sendAssignmentConfirmations({
        shiftId: id,
        assignedStaffId: staffId,
        actorUserId,
        trigger: 'assign',
      });
      return {
        shift,
        assignment: { changed: true, alreadyAssigned: false },
        notifications,
      };
    }

    const existing = await this.db
      .select({ assignedStaffId: shifts.assignedStaffId })
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

    throw new NotFoundException('Shift not found.');
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
    const rows = await this.db
      .update(shifts)
      .set({ assignedStaffId: null, status: 'pending', updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    const patch: Record<string, unknown> = { status: dto.status, updatedAt: new Date() };
    if (dto.status === 'cancelled' && dto.cancellationReason !== undefined) {
      patch.cancellationReason = dto.cancellationReason;
    }
    if (dto.status === 'pending') patch.assignedStaffId = null;
    const rows = await this.db.update(shifts).set(patch).where(eq(shifts.id, id)).returning();
    if (!rows[0]) throw new NotFoundException('Shift not found.');
    return rows[0];
  }

  // Eligible staff for a shift: active, not banned at the centre, not
  // double-booked on the same date with an overlapping time range. Marked
  // with isTop (centre top-staff) and contacted flags; sorted top-first.
  async availableStaff(shiftId: string) {
    const shift = await this.get(shiftId);

    const [active, banned, top, contacted, sameDay] = await Promise.all([
      this.db
        .select({
          id: staff.id,
          legalName: staff.legalName,
          displayName: staff.displayName,
          useDisplayName: staff.useDisplayName,
          role: staff.role,
        })
        .from(staff)
        .where(eq(staff.status, 'active'))
        .orderBy(asc(staff.legalName)),
      this.db
        .select({ staffId: staffCentreBanned.staffId })
        .from(staffCentreBanned)
        .where(eq(staffCentreBanned.centreId, shift.centreId)),
      this.db
        .select({ staffId: staffCentreTop.staffId })
        .from(staffCentreTop)
        .where(eq(staffCentreTop.centreId, shift.centreId)),
      this.db
        .select({ staffId: shiftContacted.staffId })
        .from(shiftContacted)
        .where(eq(shiftContacted.shiftId, shiftId)),
      this.db
        .select({
          assignedStaffId: shifts.assignedStaffId,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
        })
        .from(shifts)
        .where(and(eq(shifts.shiftDate, shift.shiftDate), ne(shifts.id, shiftId))),
    ]);

    const bannedSet = new Set(banned.map((b) => b.staffId));
    const topSet = new Set(top.map((t) => t.staffId));
    const contactedSet = new Set(contacted.map((c) => c.staffId));

    const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
      aStart < bEnd && bStart < aEnd;
    const doubleBooked = new Set<string>();
    for (const s of sameDay) {
      if (!s.assignedStaffId) continue;
      if (overlaps(shift.startTime, shift.endTime, s.startTime, s.endTime)) {
        doubleBooked.add(s.assignedStaffId);
      }
    }

    const eligible = active
      .filter((s) => !bannedSet.has(s.id) && !doubleBooked.has(s.id))
      .map((s) => ({ ...s, isTop: topSet.has(s.id), contacted: contactedSet.has(s.id) }));

    // Top staff first, then alphabetical by legal name.
    eligible.sort((a, b) => {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
      return a.legalName.localeCompare(b.legalName);
    });
    return eligible;
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
    return result.length;
  }
}
