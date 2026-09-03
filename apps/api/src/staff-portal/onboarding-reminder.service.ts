import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { scheduledCommunications, staffAccounts } from '../db/schema';
import {
  buildOnboardingReminderIdempotencyKey,
  communicationTypeForOnboardingOffset,
  ALL_ONBOARDING_REMINDER_COMMUNICATION_TYPES,
  ONBOARDING_REMINDER_OFFSETS_DAYS,
} from './onboarding-reminder.types';
import {
  planFutureOnboardingReminders,
  portalInvitationAnchorDate,
} from './onboarding-reminder-scheduling.util';

type DbLike = Pick<DbExecutor, 'select' | 'insert' | 'update'>;

@Injectable()
export class OnboardingReminderService {
  private readonly logger = new Logger(OnboardingReminderService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly automated: AutomatedCommunicationsService,
  ) {}

  isEligibleForScheduling(account: {
    id: string;
    status: string;
    onboardingCompletedAt: Date | null;
    createdAt: Date;
  }): boolean {
    if (!account.id) return false;
    if (account.status === 'disabled') return false;
    if (account.onboardingCompletedAt) return false;
    return true;
  }

  /** Schedule future onboarding reminder milestones from the account creation anchor. Idempotent. */
  async scheduleForAccount(
    account: typeof staffAccounts.$inferSelect,
    now: Date = new Date(),
  ): Promise<string[]> {
    if (!this.isEligibleForScheduling(account)) {
      return [];
    }

    const anchorDate = portalInvitationAnchorDate(account.createdAt);
    const plans = planFutureOnboardingReminders(anchorDate, now);
    const scheduledIds: string[] = [];

    for (const plan of plans) {
      const idempotencyKey = buildOnboardingReminderIdempotencyKey({
        accountId: account.id,
        offsetDays: plan.offsetDays,
      });

      const row = await this.automated.ensureScheduled({
        idempotencyKey,
        communicationType: communicationTypeForOnboardingOffset(plan.offsetDays),
        entityType: 'staff_account',
        entityId: account.id,
        recipientType: 'staff',
        recipientEntityId: account.staffId,
        scheduledFor: plan.scheduledFor,
      });

      if (row.status === 'scheduled') {
        scheduledIds.push(row.id);
      }
    }

    return scheduledIds;
  }

  async enqueueScheduledIds(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.automated.enqueueScheduledCommunication(id);
    }
  }

  async scheduleAndEnqueueForAccount(
    account: typeof staffAccounts.$inferSelect,
    now: Date = new Date(),
  ): Promise<void> {
    const ids = await this.scheduleForAccount(account, now);
    await this.enqueueScheduledIds(ids);
  }

  async cancelPendingForAccount(accountId: string, executor?: DbLike): Promise<number> {
    return this.automated.cancelByEntity('staff_account', accountId, executor);
  }

  async reconcileIncompleteAccounts(
    batchSize = 200,
  ): Promise<{ ensured: number; cancelled: number; enqueued: number }> {
    const now = new Date();
    let ensured = 0;
    let cancelled = 0;
    let enqueued = 0;

    const accounts = await this.db
      .select()
      .from(staffAccounts)
      .where(isNull(staffAccounts.onboardingCompletedAt))
      .limit(batchSize);

    for (const account of accounts) {
      if (!this.isEligibleForScheduling(account)) {
        cancelled += await this.cancelPendingForAccount(account.id);
        continue;
      }

      const ids = await this.scheduleForAccount(account, now);
      ensured += ids.length;
      for (const id of ids) {
        await this.automated.enqueueScheduledCommunication(id);
        enqueued += 1;
      }
    }

    const orphanedCancelled = await this.cancelOrphanedPendingReminders(batchSize);
    cancelled += orphanedCancelled;

    if (ensured > 0 || cancelled > 0) {
      this.logger.log(
        `Onboarding reminder reconciliation ensured=${ensured} cancelled=${cancelled} enqueued=${enqueued}`,
      );
    }

    return { ensured, cancelled, enqueued };
  }

  private async cancelOrphanedPendingReminders(limit = 200): Promise<number> {
    const pending = await this.db
      .select({
        id: scheduledCommunications.id,
        entityId: scheduledCommunications.entityId,
        idempotencyKey: scheduledCommunications.idempotencyKey,
      })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityType, 'staff_account'),
          inArray(scheduledCommunications.communicationType, [
            ...ALL_ONBOARDING_REMINDER_COMMUNICATION_TYPES,
          ]),
          inArray(scheduledCommunications.status, ['scheduled', 'processing']),
        ),
      )
      .limit(limit);

    let cancelled = 0;
    for (const row of pending) {
      const accountRows = await this.db
        .select()
        .from(staffAccounts)
        .where(eq(staffAccounts.id, row.entityId))
        .limit(1);

      const account = accountRows[0];
      if (!account || !this.isEligibleForScheduling(account)) {
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
        continue;
      }

      const anchorDate = portalInvitationAnchorDate(account.createdAt);
      const activePlans = planFutureOnboardingReminders(anchorDate, new Date());
      const parsedOffset = ONBOARDING_REMINDER_OFFSETS_DAYS.find((offset) =>
        row.idempotencyKey.endsWith(`:${offset}d`),
      );
      if (parsedOffset === undefined) {
        continue;
      }

      const stillActive = activePlans.some((plan) => plan.offsetDays === parsedOffset);
      if (!stillActive) {
        await this.automated.cancelByIdempotencyKeys([row.idempotencyKey]);
        cancelled += 1;
      }
    }

    return cancelled;
  }
}
