import { Inject, Injectable, Logger } from '@nestjs/common';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import type { CommunicationType } from '../automated-communications/automated-communications.types';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import {
  buildShiftCancellationIdempotencyKey,
  deriveCancellationVersion,
  type ShiftCancellationRecipient,
} from './shift-cancellation.types';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

const CANCELLATION_TYPES: Record<
  ShiftCancellationRecipient,
  CommunicationType
> = {
  centre: 'shift_cancellation_centre',
  carer: 'shift_cancellation_carer',
};

@Injectable()
export class ShiftCancellationService {
  private readonly logger = new Logger(ShiftCancellationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
  ) {}

  /** Schedule Centre + Carer cancellation emails for an assigned shift cancellation event. */
  async scheduleForAssignedCancellation(
    params: {
      shiftId: string;
      assignedStaffId: string;
      centreId: string;
      scheduledFor: Date;
    },
    executor: DbLike,
  ): Promise<string[]> {
    return this.scheduleCancellation(
      {
        ...params,
        recipients: { centre: true, carer: true },
      },
      executor,
    );
  }

  async scheduleCancellation(
    params: {
      shiftId: string;
      assignedStaffId: string | null;
      centreId: string;
      scheduledFor: Date;
      recipients: { centre: boolean; carer: boolean };
    },
    executor: DbLike,
  ): Promise<string[]> {
    const cancellationVersion = deriveCancellationVersion(params.scheduledFor);
    const scheduledIds: string[] = [];

    const recipients: Array<{
      recipient: ShiftCancellationRecipient;
      recipientEntityId: string;
    }> = [];
    if (params.recipients.centre) {
      recipients.push({ recipient: 'centre', recipientEntityId: params.centreId });
    }
    if (params.recipients.carer && params.assignedStaffId) {
      recipients.push({ recipient: 'carer', recipientEntityId: params.assignedStaffId });
    }

    for (const item of recipients) {
      const row = await this.automated.schedule(
        {
          idempotencyKey: buildShiftCancellationIdempotencyKey({
            shiftId: params.shiftId,
            cancellationVersion,
            recipient: item.recipient,
          }),
          communicationType: CANCELLATION_TYPES[item.recipient],
          entityType: 'shift',
          entityId: params.shiftId,
          recipientType: item.recipient,
          recipientEntityId: item.recipientEntityId,
          scheduledFor: params.scheduledFor,
        },
        executor,
      );
      scheduledIds.push(row.id);
    }

    return scheduledIds;
  }

  async enqueueScheduledIds(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.automated.enqueueScheduledCommunication(id);
    }
  }
}
