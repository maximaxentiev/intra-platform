import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { torontoShiftStartInstant } from './shift-toronto.util';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { scheduledCommunications, shifts } from '../db/schema';
import { planFutureShiftReminders } from './shift-reminder-scheduling.util';
import {
  SHIFT_REMINDER_COMMUNICATION_TYPE,
  buildShiftReminderIdempotencyKey,
} from './shift-reminder.types';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

const SHIFT_REMINDER_TYPES = [
  'shift_reminder_3d',
  'shift_reminder_1d',
  'shift_reminder_2h',
] as const;

@Injectable()
export class ShiftReminderService {
  private readonly logger = new Logger(ShiftReminderService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
  ) {}

  async scheduleForFilledShift(
    params: {
      shiftId: string;
      assignedStaffId: string;
      shiftDate: string;
      startTime: string;
    },
    executor: DbLike,
    now: Date = new Date(),
  ): Promise<string[]> {
    const plans = planFutureShiftReminders(params.shiftDate, params.startTime, now);
    const scheduledIds: string[] = [];

    for (const plan of plans) {
      const idempotencyKey = buildShiftReminderIdempotencyKey({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        shiftDate: params.shiftDate,
        startTime: params.startTime,
        interval: plan.interval,
      });

      const row = await this.automated.schedule(
        {
          idempotencyKey,
          communicationType: SHIFT_REMINDER_COMMUNICATION_TYPE[plan.interval],
          entityType: 'shift',
          entityId: params.shiftId,
          recipientType: 'carer',
          recipientEntityId: params.assignedStaffId,
          scheduledFor: plan.scheduledFor,
        },
        executor,
      );
      scheduledIds.push(row.id);
    }

    return scheduledIds;
  }

  async cancelPendingForShift(shiftId: string, executor?: DbLike): Promise<number> {
    const db = executor ?? this.db;
    const rows = await db
      .update(scheduledCommunications)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledCommunications.entityType, 'shift'),
          eq(scheduledCommunications.entityId, shiftId),
          inArray(scheduledCommunications.communicationType, [...SHIFT_REMINDER_TYPES]),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .returning({ id: scheduledCommunications.id });

    return rows.length;
  }

  async enqueueScheduledIds(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.automated.enqueueScheduledCommunication(id);
    }
  }

  async enqueuePendingRemindersForShift(shiftId: string): Promise<void> {
    const rows = await this.db
      .select({ id: scheduledCommunications.id })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityType, 'shift'),
          eq(scheduledCommunications.entityId, shiftId),
          inArray(scheduledCommunications.communicationType, [...SHIFT_REMINDER_TYPES]),
          eq(scheduledCommunications.status, 'scheduled'),
        ),
      );

    await this.enqueueScheduledIds(rows.map((row) => row.id));
  }

  /** Cancel pending reminders and schedule a fresh future set (filled shift). */
  async rescheduleFilledShift(
    params: {
      shiftId: string;
      assignedStaffId: string;
      shiftDate: string;
      startTime: string;
    },
    executor: DbLike,
    now: Date = new Date(),
  ): Promise<string[]> {
    await this.cancelPendingForShift(params.shiftId, executor);
    return this.scheduleForFilledShift(params, executor, now);
  }

  async reconcileFutureFilledShifts(batchSize = 200): Promise<{ ensured: number; enqueued: number }> {
    const now = new Date();
    const rows = await this.db
      .select({
        id: shifts.id,
        assignedStaffId: shifts.assignedStaffId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
      })
      .from(shifts)
      .where(and(eq(shifts.status, 'filled'), isNotNull(shifts.assignedStaffId)))
      .limit(batchSize);

    let ensured = 0;
    let enqueued = 0;

    for (const row of rows) {
      if (!row.assignedStaffId) continue;
      const shiftDate = String(row.shiftDate);
      const startTime = String(row.startTime);
      if (torontoShiftStartInstant(shiftDate, startTime).getTime() <= now.getTime()) {
        continue;
      }
      const plans = planFutureShiftReminders(shiftDate, startTime, now);

      for (const plan of plans) {
        const idempotencyKey = buildShiftReminderIdempotencyKey({
          shiftId: row.id,
          assignedStaffId: row.assignedStaffId,
          shiftDate,
          startTime,
          interval: plan.interval,
        });

        const scheduled = await this.automated.ensureScheduled({
          idempotencyKey,
          communicationType: SHIFT_REMINDER_COMMUNICATION_TYPE[plan.interval],
          entityType: 'shift',
          entityId: row.id,
          recipientType: 'carer',
          recipientEntityId: row.assignedStaffId,
          scheduledFor: plan.scheduledFor,
        });

        if (scheduled.status === 'scheduled') {
          ensured += 1;
          await this.automated.enqueueScheduledCommunication(scheduled.id);
          enqueued += 1;
        }
      }
    }

    if (ensured > 0) {
      this.logger.log(`Shift reminder reconciliation ensured=${ensured} enqueued=${enqueued}`);
    }

    return { ensured, enqueued };
  }
}
