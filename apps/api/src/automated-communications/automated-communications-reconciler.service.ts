import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledCommunicationsService } from './scheduled-communications.service';
import { CommunicationsQueueService } from './communications-queue.service';
import { DEFAULT_COMMUNICATIONS_RECONCILE_CRON } from './automated-communications.constants';

@Injectable()
export class AutomatedCommunicationsReconcilerService {
  private readonly logger = new Logger(AutomatedCommunicationsReconcilerService.name);

  constructor(
    private readonly scheduled: ScheduledCommunicationsService,
    private readonly queue: CommunicationsQueueService,
  ) {}

  /** Default every 10 minutes; override COMMUNICATIONS_RECONCILE_CRON in worker env if needed. */
  @Cron(process.env.COMMUNICATIONS_RECONCILE_CRON || DEFAULT_COMMUNICATIONS_RECONCILE_CRON)
  async reconcileScheduledJobs(): Promise<void> {
    await this.runReconciliation();
  }

  async runReconciliation(): Promise<{ recoveredStale: number; enqueued: number; skipped: number }> {
    const recoveredStale = await this.scheduled.recoverStaleProcessing();
    const rows = await this.scheduled.listScheduledForReconciliation();
    let enqueued = 0;
    let skipped = 0;

    for (const row of rows) {
      if (this.scheduled.isTerminalStatus(row.status as 'scheduled')) {
        skipped += 1;
        continue;
      }
      const created = await this.queue.ensureJobExists({
        scheduledCommunicationId: row.id,
        idempotencyKey: row.idempotencyKey,
        scheduledFor: row.scheduledFor,
      });
      if (created) enqueued += 1;
      else skipped += 1;
    }

    if (enqueued > 0 || recoveredStale > 0) {
      this.logger.log(
        `Reconciled communications enqueued=${enqueued} skipped=${skipped} staleRecovered=${recoveredStale}`,
      );
    }

    return { recoveredStale, enqueued, skipped };
  }
}
