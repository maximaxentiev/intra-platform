import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { EmailService } from '../email/email.service';
import {
  AUTOMATED_COMMUNICATIONS_QUEUE_NAME,
  COMMUNICATION_FAILURE_CODE,
  DEFAULT_COMMUNICATIONS_WORKER_CONCURRENCY,
  RESEND_IDEMPOTENCY_WINDOW_MS,
} from './automated-communications.constants';
import { createBullMqRedisConnection } from './bullmq-connection.util';
import { deriveProviderIdempotencyKey } from './bullmq-job-id.util';
import {
  bullMqCustomBackoffStrategy,
  CommunicationsQueueService,
} from './communications-queue.service';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { CommunicationProcessorRegistry } from './communication-processor.registry';
import type { CommunicationJobPayload, CommunicationType } from './automated-communications.types';
import {
  classifyEmailDeliveryError,
  sanitizeCommunicationFailureReason,
} from './communication-retry.util';
import { isCommunicationType } from './automated-communications.types';
import { DEFAULT_COMMUNICATIONS_QUEUE_PREFIX } from './automated-communications.constants';

@Injectable()
export class AutomatedCommunicationsProcessor {
  private readonly logger = new Logger(AutomatedCommunicationsProcessor.name);
  private worker: Worker<CommunicationJobPayload> | null = null;
  private workerConnection: Redis | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly scheduled: ScheduledCommunicationsService,
    private readonly email: EmailService,
    private readonly registry: CommunicationProcessorRegistry,
    private readonly queueService: CommunicationsQueueService,
  ) {}

  startWorker(): Worker<CommunicationJobPayload> {
    if (this.worker) return this.worker;

    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    const prefix =
      this.config.get<string>('COMMUNICATIONS_QUEUE_PREFIX') ?? DEFAULT_COMMUNICATIONS_QUEUE_PREFIX;
    const concurrency = Number(
      this.config.get('COMMUNICATIONS_WORKER_CONCURRENCY') ?? DEFAULT_COMMUNICATIONS_WORKER_CONCURRENCY,
    );

    this.workerConnection = createBullMqRedisConnection(redisUrl, 'worker');
    this.worker = new Worker<CommunicationJobPayload>(
      AUTOMATED_COMMUNICATIONS_QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: this.workerConnection,
        prefix,
        concurrency,
        settings: {
          backoffStrategy: bullMqCustomBackoffStrategy,
        },
      },
    );

    this.worker.on('failed', async (job, error) => {
      if (!job) return;
      const maxAttempts = this.queueService.getRetryAttempts();
      if (job.attemptsMade >= maxAttempts) {
        await this.scheduled.markFailed(
          job.data.scheduledCommunicationId,
          COMMUNICATION_FAILURE_CODE.deliveryFailed,
          error.message,
        );
      }
      this.logger.warn(
        `Job failed communicationId=${job.data.scheduledCommunicationId} attempts=${job.attemptsMade}: ${error.message}`,
      );
    });

    return this.worker;
  }

  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.workerConnection) {
      await this.workerConnection.quit().catch(() => undefined);
      this.workerConnection = null;
    }
  }

  async processJob(job: Job<CommunicationJobPayload>): Promise<void> {
    const communicationId = job.data.scheduledCommunicationId;
    const row = await this.scheduled.findById(communicationId);
    if (!row) {
      throw new UnrecoverableError('Scheduled communication not found.');
    }

    if (row.status === 'sent') {
      this.logger.debug(`Already sent communicationId=${communicationId}`);
      return;
    }

    if (row.status === 'cancelled' || row.status === 'failed') {
      throw new UnrecoverableError(`Communication terminal status=${row.status}`);
    }

    if (row.status === 'processing') {
      const staleMs = Date.now() - row.updatedAt.getTime();
      if (staleMs > RESEND_IDEMPOTENCY_WINDOW_MS) {
        await this.scheduled.markFailed(
          communicationId,
          COMMUNICATION_FAILURE_CODE.uncertainSend,
          'Previous send may have succeeded outside the idempotency window.',
        );
        throw new UnrecoverableError(COMMUNICATION_FAILURE_CODE.uncertainSend);
      }
    }

    const processing = await this.scheduled.markProcessing(communicationId);
    if (!processing) {
      const latest = await this.scheduled.findById(communicationId);
      if (latest?.status === 'sent') return;
      throw new UnrecoverableError('Could not mark communication processing.');
    }

    const attemptNumber = processing.attempts;

    if (!isCommunicationType(row.communicationType)) {
      await this.recordSkipped(
        row.id,
        row.idempotencyKey,
        attemptNumber,
        COMMUNICATION_FAILURE_CODE.unsupportedType,
        'Unsupported communication type.',
      );
      throw new UnrecoverableError(COMMUNICATION_FAILURE_CODE.unsupportedType);
    }

    const processor = this.registry.get(row.communicationType);
    if (!processor) {
      await this.recordSkipped(
        row.id,
        row.idempotencyKey,
        attemptNumber,
        COMMUNICATION_FAILURE_CODE.unsupportedType,
        'No processor registered for communication type.',
      );
      throw new UnrecoverableError(COMMUNICATION_FAILURE_CODE.unsupportedType);
    }

    const outcome = await processor.evaluate(this.db, {
        scheduledCommunicationId: row.id,
        communicationType: row.communicationType,
        entityType: row.entityType,
        entityId: row.entityId,
        recipientType: row.recipientType,
        recipientEntityId: row.recipientEntityId,
    });

    if (outcome.kind === 'stale') {
      await this.scheduled.markCancelled(
        row.id,
        COMMUNICATION_FAILURE_CODE.staleJob,
        'Communication is no longer valid.',
      );
      await this.scheduled.recordDeliveryAttempt({
        scheduledCommunicationId: row.id,
        idempotencyKey: row.idempotencyKey,
        attemptNumber,
        recipientEmail: '',
        status: 'skipped',
        failureCode: COMMUNICATION_FAILURE_CODE.staleJob,
        failureReason: 'Communication is no longer valid.',
      });
      return;
    }

    if (outcome.kind === 'skipped') {
      await this.recordSkipped(row.id, row.idempotencyKey, attemptNumber, outcome.code, outcome.reason);
      await this.scheduled.markCancelled(row.id, outcome.code, outcome.reason);
      return;
    }

    if (outcome.kind === 'permanent_failure') {
      await this.recordFailed(row.id, row.idempotencyKey, attemptNumber, '', outcome.code, outcome.reason);
      await this.scheduled.markFailed(row.id, outcome.code, outcome.reason);
      throw new UnrecoverableError(outcome.reason);
    }

    if (!this.email.isConfigured()) {
      await this.recordSkipped(
        row.id,
        row.idempotencyKey,
        attemptNumber,
        'email_not_configured',
        'Email is not configured on this server.',
      );
      await this.scheduled.markFailed(row.id, 'email_not_configured', 'Email is not configured.');
      throw new UnrecoverableError('Email is not configured.');
    }

    const providerKey = deriveProviderIdempotencyKey(row.id);

    try {
      const result = await this.email.send({
        to: outcome.recipientEmail,
        subject: outcome.subject,
        html: outcome.html,
        text: outcome.text,
        idempotencyKey: providerKey,
      });

      await this.scheduled.recordDeliveryAttempt({
        scheduledCommunicationId: row.id,
        idempotencyKey: row.idempotencyKey,
        attemptNumber,
        recipientEmail: outcome.recipientEmail,
        status: 'sent',
        providerId: result.providerId ?? null,
        sentAt: new Date(),
      });
      await this.scheduled.markSent(row.id);
      this.logger.log(
        `Communication sent id=${row.id} type=${row.communicationType} attempt=${attemptNumber}`,
      );
    } catch (error) {
      const reason = sanitizeCommunicationFailureReason(
        error instanceof Error ? error.message : 'Send failed.',
      );
      const code =
        classifyEmailDeliveryError(error) === 'permanent'
          ? COMMUNICATION_FAILURE_CODE.sendFailed
          : COMMUNICATION_FAILURE_CODE.deliveryFailed;

      await this.recordFailed(
        row.id,
        row.idempotencyKey,
        attemptNumber,
        outcome.recipientEmail,
        code,
        reason,
      );

      if (classifyEmailDeliveryError(error) === 'permanent') {
        await this.scheduled.markFailed(row.id, code, reason);
        throw new UnrecoverableError(reason);
      }

      await this.scheduled.markScheduledForRetry(row.id, code, reason);
      throw error;
    }
  }

  private async recordSkipped(
    scheduledCommunicationId: string,
    idempotencyKey: string,
    attemptNumber: number,
    code: string,
    reason: string,
  ) {
    await this.scheduled.recordDeliveryAttempt({
      scheduledCommunicationId,
      idempotencyKey,
      attemptNumber,
      recipientEmail: '',
      status: 'skipped',
      failureCode: code,
      failureReason: reason,
    });
  }

  private async recordFailed(
    scheduledCommunicationId: string,
    idempotencyKey: string,
    attemptNumber: number,
    recipientEmail: string,
    code: string,
    reason: string,
  ) {
    await this.scheduled.recordDeliveryAttempt({
      scheduledCommunicationId,
      idempotencyKey,
      attemptNumber,
      recipientEmail,
      status: 'failed',
      failureCode: code,
      failureReason: reason,
    });
  }
}
