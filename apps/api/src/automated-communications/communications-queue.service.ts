import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import {
  AUTOMATED_COMMUNICATIONS_QUEUE_NAME,
  BULLMQ_COMPLETED_JOB_RETENTION_COUNT,
  BULLMQ_FAILED_JOB_RETENTION_MS,
  DEFAULT_COMMUNICATIONS_QUEUE_PREFIX,
  DEFAULT_COMMUNICATIONS_RETRY_ATTEMPTS,
} from './automated-communications.constants';
import { createBullMqRedisConnection } from './bullmq-connection.util';
import { deriveBullMqJobId } from './bullmq-job-id.util';
import type { CommunicationJobPayload } from './automated-communications.types';
import { communicationRetryBackoffMs } from './communication-retry.util';

export type EnqueueCommunicationParams = {
  scheduledCommunicationId: string;
  idempotencyKey: string;
  scheduledFor: Date;
};

export type SyncJobScheduleResult = 'created' | 'rescheduled' | 'unchanged';

@Injectable()
export class CommunicationsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsQueueService.name);
  private readonly queuePrefix: string;
  private readonly queueConnection: Redis;
  private readonly queue: Queue<CommunicationJobPayload>;
  private readonly scheduleSyncToleranceMs = 1000;

  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');
    this.queuePrefix =
      config.get<string>('COMMUNICATIONS_QUEUE_PREFIX') ?? DEFAULT_COMMUNICATIONS_QUEUE_PREFIX;
    this.queueConnection = createBullMqRedisConnection(redisUrl, 'queue');
    this.queue = new Queue<CommunicationJobPayload>(AUTOMATED_COMMUNICATIONS_QUEUE_NAME, {
      connection: this.queueConnection,
      prefix: this.queuePrefix,
      defaultJobOptions: {
        attempts: Number(config.get('COMMUNICATIONS_RETRY_ATTEMPTS') ?? DEFAULT_COMMUNICATIONS_RETRY_ATTEMPTS),
        removeOnComplete: { count: BULLMQ_COMPLETED_JOB_RETENTION_COUNT },
        removeOnFail: { age: BULLMQ_FAILED_JOB_RETENTION_MS },
        backoff: {
          type: 'custom',
        },
      },
    });
  }

  getRetryAttempts(): number {
    return this.queue.opts.defaultJobOptions?.attempts ?? DEFAULT_COMMUNICATIONS_RETRY_ATTEMPTS;
  }

  computeDelayMs(scheduledFor: Date, now = new Date()): number {
    return Math.max(0, scheduledFor.getTime() - now.getTime());
  }

  private expectedJobFireTime(job: { timestamp?: number; delay?: number }): number {
    return (job.timestamp ?? Date.now()) + (job.delay ?? 0);
  }

  async syncJobSchedule(params: EnqueueCommunicationParams): Promise<SyncJobScheduleResult> {
    const jobId = deriveBullMqJobId(params.idempotencyKey);
    const expectedDelay = this.computeDelayMs(params.scheduledFor);
    const expectedFireTime = params.scheduledFor.getTime();
    const existing = await this.queue.getJob(jobId);

    if (!existing) {
      await this.enqueue(params);
      return 'created';
    }

    const state = await existing.getState();
    if (state === 'active') {
      return 'unchanged';
    }

    if (state === 'completed' || state === 'failed') {
      await existing.remove().catch(() => undefined);
      await this.enqueue(params);
      return 'created';
    }

    const currentFireTime = this.expectedJobFireTime(existing);
    const delayMatches =
      Math.abs(currentFireTime - expectedFireTime) <= this.scheduleSyncToleranceMs;
    const optsDelay = typeof existing.opts.delay === 'number' ? existing.opts.delay : null;
    const delayMsMatches =
      optsDelay !== null && Math.abs(optsDelay - expectedDelay) <= this.scheduleSyncToleranceMs;

    if (delayMatches || delayMsMatches) {
      return 'unchanged';
    }

    await existing.remove().catch(() => undefined);
    await this.enqueue(params);
    return 'rescheduled';
  }

  async enqueue(params: EnqueueCommunicationParams): Promise<void> {
    const jobId = deriveBullMqJobId(params.idempotencyKey);
    const delay = this.computeDelayMs(params.scheduledFor);
    const options: JobsOptions = {
      jobId,
      delay,
      backoff: {
        type: 'custom',
      },
    };

    try {
      await this.queue.add(
        'deliver',
        { scheduledCommunicationId: params.scheduledCommunicationId },
        options,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Job already exists') || message.includes('jobId')) {
        this.logger.debug(`BullMQ job already exists jobId=${jobId}`);
        return;
      }
      throw error;
    }
  }

  async ensureJobExists(params: EnqueueCommunicationParams): Promise<boolean> {
    const result = await this.syncJobSchedule(params);
    return result === 'created' || result === 'rescheduled';
  }

  async getJobState(idempotencyKey: string): Promise<string | null> {
    const job = await this.queue.getJob(deriveBullMqJobId(idempotencyKey));
    if (!job) return null;
    return job.getState();
  }

  async getJobFireTime(idempotencyKey: string): Promise<number | null> {
    const job = await this.queue.getJob(deriveBullMqJobId(idempotencyKey));
    if (!job) return null;
    return this.expectedJobFireTime(job);
  }

  async onModuleDestroy() {
    await this.queue.close().catch(() => undefined);
    await this.queueConnection.quit().catch(() => undefined);
  }
}

export function bullMqCustomBackoffStrategy(attemptsMade: number): number {
  return communicationRetryBackoffMs(attemptsMade);
}
