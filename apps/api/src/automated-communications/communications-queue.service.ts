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

@Injectable()
export class CommunicationsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsQueueService.name);
  private readonly queuePrefix: string;
  private readonly queueConnection: Redis;
  private readonly queue: Queue<CommunicationJobPayload>;

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
    const jobId = deriveBullMqJobId(params.idempotencyKey);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove().catch(() => undefined);
      } else {
        return false;
      }
    }
    await this.enqueue(params);
    return true;
  }

  async getJobState(idempotencyKey: string): Promise<string | null> {
    const job = await this.queue.getJob(deriveBullMqJobId(idempotencyKey));
    if (!job) return null;
    return job.getState();
  }

  async onModuleDestroy() {
    await this.queue.close().catch(() => undefined);
    await this.queueConnection.quit().catch(() => undefined);
  }
}

export function bullMqCustomBackoffStrategy(attemptsMade: number): number {
  return communicationRetryBackoffMs(attemptsMade);
}
