import { Inject, Injectable } from '@nestjs/common';
import { shiftAssignmentNotifications } from '../db/schema';
import { DRIZZLE, type Database } from '../db/drizzle.module';

type RecipientType = 'centre' | 'carer';
type Trigger = 'assign' | 'resend';
type Status = 'sent' | 'failed' | 'skipped';

export type PersistShiftAssignmentNotificationParams = {
  shiftId: string;
  assignedStaffId: string;
  recipientType: RecipientType;
  recipientEmail: string;
  trigger: Trigger;
  status: Status;
  providerId?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  actorUserId: string;
  sentAt?: Date | null;
};

@Injectable()
export class ShiftAssignmentNotificationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(params: PersistShiftAssignmentNotificationParams) {
    const rows = await this.db
      .insert(shiftAssignmentNotifications)
      .values({
        shiftId: params.shiftId,
        assignedStaffId: params.assignedStaffId,
        recipientType: params.recipientType,
        recipientEmail: params.recipientEmail,
        trigger: params.trigger,
        status: params.status,
        providerId: params.providerId ?? null,
        failureCode: params.failureCode ?? null,
        failureReason: params.failureReason ?? null,
        actorUserId: params.actorUserId,
        sentAt: params.sentAt ?? null,
      })
      .returning();
    return rows[0];
  }
}
