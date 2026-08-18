import { Injectable, Logger } from '@nestjs/common';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { CommunicationsQueueService } from './communications-queue.service';
import type { ScheduleCommunicationInput, ScheduledCommunicationStatus } from './automated-communications.types';
import type { DbExecutor } from '../db/drizzle.module';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

@Injectable()
export class AutomatedCommunicationsService {
  private readonly logger = new Logger(AutomatedCommunicationsService.name);

  constructor(
    private readonly scheduled: ScheduledCommunicationsService,
    private readonly queue: CommunicationsQueueService,
  ) {}

  /** Insert schedule row — safe inside an existing transaction. */
  async schedule(input: ScheduleCommunicationInput, executor?: DbLike) {
    return this.scheduled.schedule(input, executor ?? undefined);
  }

  /** Best-effort enqueue after transaction commit. */
  async enqueueScheduledCommunication(scheduledCommunicationId: string): Promise<void> {
    const row = await this.scheduled.findById(scheduledCommunicationId);
    if (!row) {
      this.logger.warn(`Cannot enqueue missing communication id=${scheduledCommunicationId}`);
      return;
    }
    if (this.scheduled.isTerminalStatus(row.status as ScheduledCommunicationStatus)) {
      return;
    }
    try {
      await this.queue.enqueue({
        scheduledCommunicationId: row.id,
        idempotencyKey: row.idempotencyKey,
        scheduledFor: row.scheduledFor,
      });
    } catch (error) {
      this.logger.warn(
        `Enqueue failed communicationId=${row.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async scheduleAndEnqueue(input: ScheduleCommunicationInput, executor?: DbLike) {
    const row = await this.schedule(input, executor);
    if (!executor) {
      await this.enqueueScheduledCommunication(row.id);
    }
    return row;
  }

  async cancelByIdempotencyKeys(keys: string[], executor?: DbLike) {
    return this.scheduled.cancelByIdempotencyKeys(keys, executor ?? undefined);
  }

  async cancelByEntity(entityType: string, entityId: string, executor?: DbLike) {
    return this.scheduled.cancelByEntity(entityType, entityId, executor ?? undefined);
  }
}
