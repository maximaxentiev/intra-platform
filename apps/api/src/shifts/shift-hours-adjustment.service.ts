import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  shiftHoursAdjustments,
  shiftHoursCapabilities,
  shifts,
  users,
} from '../db/schema';
import {
  deriveScheduledDurationMinutes,
  toShiftHoursBadRequest,
  validateActualHoursInput,
} from './shift-hours-validation.util';
import { buildOpsOverrideIdempotencyKey } from './shift-hours.types';

export type OpsOverrideActualHoursInput = {
  actualStartTime: string;
  actualEndTime: string;
  note: string;
  finalize?: boolean;
};

export type ShiftHoursAdjustmentRecord = {
  id: string;
  shiftId: string;
  assignedStaffId: string;
  source: 'centre' | 'ops';
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  scheduledShiftDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  scheduledTotalMinutes: number;
  actualStartTime: string;
  actualEndTime: string;
  actualTotalMinutes: number;
  assignmentEpoch: number;
  note: string;
  supersededAt: Date | null;
  isCurrent: boolean;
  createdAt: Date;
};

const OPS_OVERRIDE_ALLOWED_STATUSES = new Set(['filled', 'completed', 'cancelled']);

@Injectable()
export class ShiftHoursAdjustmentService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listAdjustments(shiftId: string): Promise<ShiftHoursAdjustmentRecord[]> {
    await this.assertShiftExists(shiftId);

    const rows = await this.db
      .select({
        id: shiftHoursAdjustments.id,
        shiftId: shiftHoursAdjustments.shiftId,
        assignedStaffId: shiftHoursAdjustments.assignedStaffId,
        source: shiftHoursAdjustments.source,
        actorUserId: shiftHoursAdjustments.actorUserId,
        actorDisplayName: users.fullName,
        actorEmail: users.email,
        scheduledShiftDate: shiftHoursAdjustments.scheduledShiftDate,
        scheduledStartTime: shiftHoursAdjustments.scheduledStartTime,
        scheduledEndTime: shiftHoursAdjustments.scheduledEndTime,
        scheduledTotalMinutes: shiftHoursAdjustments.scheduledTotalMinutes,
        actualStartTime: shiftHoursAdjustments.actualStartTime,
        actualEndTime: shiftHoursAdjustments.actualEndTime,
        actualTotalMinutes: shiftHoursAdjustments.actualTotalMinutes,
        assignmentEpoch: shiftHoursAdjustments.assignmentEpoch,
        note: shiftHoursAdjustments.note,
        supersededAt: shiftHoursAdjustments.supersededAt,
        createdAt: shiftHoursAdjustments.createdAt,
        currentHoursAdjustmentId: shifts.currentHoursAdjustmentId,
      })
      .from(shiftHoursAdjustments)
      .innerJoin(shifts, eq(shifts.id, shiftHoursAdjustments.shiftId))
      .leftJoin(users, eq(users.id, shiftHoursAdjustments.actorUserId))
      .where(eq(shiftHoursAdjustments.shiftId, shiftId))
      .orderBy(asc(shiftHoursAdjustments.createdAt));

    return rows.map((row) => ({
      id: row.id,
      shiftId: row.shiftId,
      assignedStaffId: row.assignedStaffId,
      source: row.source,
      actorUserId: row.actorUserId,
      actorDisplayName: row.actorDisplayName,
      actorEmail: row.actorEmail,
      scheduledShiftDate: String(row.scheduledShiftDate),
      scheduledStartTime: String(row.scheduledStartTime),
      scheduledEndTime: String(row.scheduledEndTime),
      scheduledTotalMinutes: row.scheduledTotalMinutes,
      actualStartTime: String(row.actualStartTime),
      actualEndTime: String(row.actualEndTime),
      actualTotalMinutes: row.actualTotalMinutes,
      assignmentEpoch: row.assignmentEpoch,
      note: row.note,
      supersededAt: row.supersededAt,
      isCurrent: row.currentHoursAdjustmentId === row.id,
      createdAt: row.createdAt,
    }));
  }

  async overrideActualHours(params: {
    shiftId: string;
    actorUserId: string;
    input: OpsOverrideActualHoursInput;
    idempotencyKey: string;
  }): Promise<{ adjustment: ShiftHoursAdjustmentRecord; created: boolean }> {
    const scopedKey = buildOpsOverrideIdempotencyKey({
      shiftId: params.shiftId,
      actorUserId: params.actorUserId,
      clientKey: params.idempotencyKey,
    });

    const existing = await this.findAdjustmentByIdempotencyKey(scopedKey);
    if (existing) {
      return { adjustment: existing, created: false };
    }

    const note = params.input.note.trim();
    if (!note) {
      throw new BadRequestException('An audit note is required for Ops hours override.');
    }

    try {
      return await this.db.transaction(async (tx) => {
        const lockedRows = await tx
          .select({
            id: shifts.id,
            status: shifts.status,
            assignedStaffId: shifts.assignedStaffId,
            shiftDate: shifts.shiftDate,
            startTime: shifts.startTime,
            endTime: shifts.endTime,
            currentHoursAdjustmentId: shifts.currentHoursAdjustmentId,
            hoursFinalizedAt: shifts.hoursFinalizedAt,
          })
          .from(shifts)
          .where(eq(shifts.id, params.shiftId))
          .for('update');
        const shift = lockedRows[0];
        if (!shift) throw new NotFoundException('Shift not found.');

        if (!shift.assignedStaffId) {
          throw new BadRequestException('Shift has no assigned staff member.');
        }
        if (!OPS_OVERRIDE_ALLOWED_STATUSES.has(shift.status)) {
          throw new BadRequestException('Actual hours override is not allowed for this shift status.');
        }

        const validated = validateActualHoursInput({
          actualStartTime: params.input.actualStartTime,
          actualEndTime: params.input.actualEndTime,
          scheduledStartTime: String(shift.startTime),
          scheduledEndTime: String(shift.endTime),
        });

        const scheduledTotalMinutes = deriveScheduledDurationMinutes(
          String(shift.startTime),
          String(shift.endTime),
        );

        const assignmentEpoch = await this.resolveAssignmentEpoch(
          tx,
          params.shiftId,
          shift.assignedStaffId,
        );

        const capabilityRows = await tx
          .select({ id: shiftHoursCapabilities.id })
          .from(shiftHoursCapabilities)
          .where(eq(shiftHoursCapabilities.shiftId, params.shiftId))
          .limit(1);

        const inserted = await tx
          .insert(shiftHoursAdjustments)
          .values({
            shiftId: params.shiftId,
            assignedStaffId: shift.assignedStaffId,
            source: 'ops',
            actorUserId: params.actorUserId,
            scheduledShiftDate: String(shift.shiftDate),
            scheduledStartTime: String(shift.startTime),
            scheduledEndTime: String(shift.endTime),
            scheduledTotalMinutes,
            actualStartTime: validated.actualStartTime,
            actualEndTime: validated.actualEndTime,
            actualTotalMinutes: validated.actualTotalMinutes,
            assignmentEpoch,
            capabilityId: capabilityRows[0]?.id ?? null,
            idempotencyKey: scopedKey,
            note,
          })
          .returning({ id: shiftHoursAdjustments.id });

        const adjustmentId = inserted[0]!.id;

        if (shift.currentHoursAdjustmentId) {
          await tx
            .update(shiftHoursAdjustments)
            .set({ supersededAt: new Date() })
            .where(
              and(
                eq(shiftHoursAdjustments.id, shift.currentHoursAdjustmentId),
                isNull(shiftHoursAdjustments.supersededAt),
              ),
            );
        }

        const shiftPatch: Record<string, unknown> = {
          actualStartTime: validated.actualStartTime,
          actualEndTime: validated.actualEndTime,
          actualTotalMinutes: validated.actualTotalMinutes,
          currentHoursSource: 'ops',
          currentHoursAdjustmentId: adjustmentId,
          updatedAt: new Date(),
        };

        if (params.input.finalize) {
          shiftPatch.hoursFinalizedAt = new Date();
          shiftPatch.hoursFinalizedByUserId = params.actorUserId;

          if (capabilityRows[0]) {
            await tx
              .update(shiftHoursCapabilities)
              .set({ finalizedAt: new Date() })
              .where(eq(shiftHoursCapabilities.id, capabilityRows[0].id));
          }
        }

        await tx.update(shifts).set(shiftPatch).where(eq(shifts.id, params.shiftId));

        const record = await this.getAdjustmentRecord(tx, adjustmentId);
        if (!record) throw new ConflictException('Failed to load created adjustment.');
        return { adjustment: record, created: true };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('shift_hours_adjustments_idempotency_key_idx')
      ) {
        const existingAfterRace = await this.findAdjustmentByIdempotencyKey(scopedKey);
        if (existingAfterRace) {
          return { adjustment: existingAfterRace, created: false };
        }
      }
      throw toShiftHoursBadRequest(error);
    }
  }

  private async findAdjustmentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ShiftHoursAdjustmentRecord | null> {
    const rows = await this.db
      .select({ id: shiftHoursAdjustments.id })
      .from(shiftHoursAdjustments)
      .where(eq(shiftHoursAdjustments.idempotencyKey, idempotencyKey))
      .limit(1);
    if (!rows[0]) return null;
    return this.getAdjustmentRecord(this.db, rows[0].id);
  }

  private async getAdjustmentRecord(
    executor: Pick<Database, 'select'>,
    adjustmentId: string,
  ): Promise<ShiftHoursAdjustmentRecord | null> {
    const rows = await executor
      .select({
        id: shiftHoursAdjustments.id,
        shiftId: shiftHoursAdjustments.shiftId,
        assignedStaffId: shiftHoursAdjustments.assignedStaffId,
        source: shiftHoursAdjustments.source,
        actorUserId: shiftHoursAdjustments.actorUserId,
        actorDisplayName: users.fullName,
        actorEmail: users.email,
        scheduledShiftDate: shiftHoursAdjustments.scheduledShiftDate,
        scheduledStartTime: shiftHoursAdjustments.scheduledStartTime,
        scheduledEndTime: shiftHoursAdjustments.scheduledEndTime,
        scheduledTotalMinutes: shiftHoursAdjustments.scheduledTotalMinutes,
        actualStartTime: shiftHoursAdjustments.actualStartTime,
        actualEndTime: shiftHoursAdjustments.actualEndTime,
        actualTotalMinutes: shiftHoursAdjustments.actualTotalMinutes,
        assignmentEpoch: shiftHoursAdjustments.assignmentEpoch,
        note: shiftHoursAdjustments.note,
        supersededAt: shiftHoursAdjustments.supersededAt,
        createdAt: shiftHoursAdjustments.createdAt,
        currentHoursAdjustmentId: shifts.currentHoursAdjustmentId,
      })
      .from(shiftHoursAdjustments)
      .innerJoin(shifts, eq(shifts.id, shiftHoursAdjustments.shiftId))
      .leftJoin(users, eq(users.id, shiftHoursAdjustments.actorUserId))
      .where(eq(shiftHoursAdjustments.id, adjustmentId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      shiftId: row.shiftId,
      assignedStaffId: row.assignedStaffId,
      source: row.source,
      actorUserId: row.actorUserId,
      actorDisplayName: row.actorDisplayName,
      actorEmail: row.actorEmail,
      scheduledShiftDate: String(row.scheduledShiftDate),
      scheduledStartTime: String(row.scheduledStartTime),
      scheduledEndTime: String(row.scheduledEndTime),
      scheduledTotalMinutes: row.scheduledTotalMinutes,
      actualStartTime: String(row.actualStartTime),
      actualEndTime: String(row.actualEndTime),
      actualTotalMinutes: row.actualTotalMinutes,
      assignmentEpoch: row.assignmentEpoch,
      note: row.note,
      supersededAt: row.supersededAt,
      isCurrent: row.currentHoursAdjustmentId === row.id,
      createdAt: row.createdAt,
    };
  }

  private async resolveAssignmentEpoch(
    executor: Pick<Database, 'select'>,
    shiftId: string,
    assignedStaffId: string,
  ): Promise<number> {
    const rows = await executor
      .select({
        assignmentEpoch: shiftHoursCapabilities.assignmentEpoch,
        assignedStaffId: shiftHoursCapabilities.assignedStaffId,
      })
      .from(shiftHoursCapabilities)
      .where(eq(shiftHoursCapabilities.shiftId, shiftId))
      .limit(1);

    const capability = rows[0];
    if (!capability) return 1;
    if (capability.assignedStaffId !== assignedStaffId) {
      throw new ConflictException('Capability assignment epoch does not match current assignee.');
    }
    return capability.assignmentEpoch;
  }

  private async assertShiftExists(shiftId: string): Promise<void> {
    const rows = await this.db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Shift not found.');
  }
}
