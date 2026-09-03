import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { OnboardingReminderService } from './onboarding-reminder.service';
import type { staffAccounts } from '../db/schema';
import {
  buildOnboardingReminderIdempotencyKey,
  ONBOARDING_REMINDER_OFFSETS_DAYS,
} from './onboarding-reminder.types';

type AccountRow = typeof staffAccounts.$inferSelect;

const ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';

function account(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: ACCOUNT_ID,
    staffId: STAFF_ID,
    email: 'carer@example.test',
    passwordHash: null,
    status: 'invited',
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    inviteSentAt: new Date('2026-09-01T12:00:00.000Z'),
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    passwordResetRequestedAt: null,
    onboardingStep: 1,
    profileCompletedAt: null,
    documentsCompletedAt: null,
    availabilityCompletedAt: null,
    onboardingCompletedAt: null,
    onboardingStartedAt: null,
    availabilityOnboardingWeek1Start: null,
    lastLoginAt: null,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
    updatedAt: new Date('2026-09-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('OnboardingReminderService', () => {
  let automated: AutomatedCommunicationsService;
  let service: OnboardingReminderService;
  let scheduledRows: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    scheduledRows = new Map();
    automated = {
      ensureScheduled: vi.fn(async (input) => {
        const existing = scheduledRows.get(input.idempotencyKey);
        if (existing) return existing;
        const row = {
          id: `comm-${scheduledRows.size + 1}`,
          ...input,
          status: 'scheduled',
        };
        scheduledRows.set(input.idempotencyKey, row);
        return row;
      }),
      enqueueScheduledCommunication: vi.fn(),
      cancelByEntity: vi.fn(async (_entityType, entityId) => {
        let count = 0;
        for (const [key, row] of scheduledRows) {
          if (row.entityId === entityId && row.status === 'scheduled') {
            row.status = 'cancelled';
            scheduledRows.set(key, row);
            count += 1;
          }
        }
        return count;
      }),
      cancelByIdempotencyKeys: vi.fn(async (keys: string[]) => {
        let count = 0;
        for (const key of keys) {
          const row = scheduledRows.get(key);
          if (row && row.status === 'scheduled') {
            row.status = 'cancelled';
            count += 1;
          }
        }
        return count;
      }),
    } as unknown as AutomatedCommunicationsService;

    service = new OnboardingReminderService({} as never, automated);
  });

  it('does not schedule for disabled or completed accounts', () => {
    expect(service.isEligibleForScheduling(account({ status: 'disabled' }))).toBe(false);
    expect(service.isEligibleForScheduling(account({ onboardingCompletedAt: new Date() }))).toBe(
      false,
    );
  });

  it('schedules future milestones after first invitation', async () => {
    const now = new Date('2026-09-01T13:00:00.000Z');
    const ids = await service.scheduleForAccount(account(), now);
    expect(ids).toHaveLength(5);
    expect(automated.ensureScheduled).toHaveBeenCalledTimes(5);
    for (const offset of ONBOARDING_REMINDER_OFFSETS_DAYS) {
      expect(
        scheduledRows.has(
          buildOnboardingReminderIdempotencyKey({ accountId: ACCOUNT_ID, offsetDays: offset }),
        ),
      ).toBe(true);
    }
  });

  it('resend does not create duplicate milestone records', async () => {
    const now = new Date('2026-09-01T13:00:00.000Z');
    await service.scheduleForAccount(account(), now);
    vi.mocked(automated.ensureScheduled).mockClear();
    await service.scheduleForAccount(account(), new Date('2026-09-05T13:00:00.000Z'));
    expect(scheduledRows.size).toBe(5);
  });

  it('existing carer invited 5 days ago schedules only day 7/14/30', async () => {
    const ids = await service.scheduleForAccount(
      account({ createdAt: new Date('2026-09-01T12:00:00.000Z') }),
      new Date('2026-09-06T12:00:00.000Z'),
    );
    expect(ids).toHaveLength(3);
    expect([...scheduledRows.keys()].every((k) => k.includes('onboarding_reminder'))).toBe(true);
    expect([...scheduledRows.keys()].some((k) => k.endsWith(':7d'))).toBe(true);
    expect([...scheduledRows.keys()].some((k) => k.endsWith(':14d'))).toBe(true);
    expect([...scheduledRows.keys()].some((k) => k.endsWith(':30d'))).toBe(true);
  });

  it('existing carer invited 20 days ago schedules only day 30', async () => {
    const ids = await service.scheduleForAccount(
      account({ createdAt: new Date('2026-09-01T12:00:00.000Z') }),
      new Date('2026-09-21T12:00:00.000Z'),
    );
    expect(ids).toHaveLength(1);
    expect([...scheduledRows.keys()][0]).toContain(':30d');
  });

  it('existing carer invited 40 days ago schedules nothing', async () => {
    const ids = await service.scheduleForAccount(
      account({ createdAt: new Date('2026-08-01T12:00:00.000Z') }),
      new Date('2026-09-10T12:00:00.000Z'),
    );
    expect(ids).toHaveLength(0);
  });

  it('cancels pending reminders when onboarding completes', async () => {
    await service.scheduleForAccount(account(), new Date('2026-09-01T13:00:00.000Z'));
    const cancelled = await service.cancelPendingForAccount(ACCOUNT_ID);
    expect(cancelled).toBe(5);
    expect([...scheduledRows.values()].every((row) => row.status === 'cancelled')).toBe(true);
  });
});

describe('OnboardingReminderCommunicationProcessor', () => {
  it('returns stale when onboarding is complete at delivery time', async () => {
    const { OnboardingReminderCommunicationProcessor } = await import(
      './onboarding-reminder.processor'
    );
    const config = {
      get: (key: string) => {
        if (key === 'CARER_PORTAL_ENABLED') return 'true';
        if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      },
    };

    const processor = new OnboardingReminderCommunicationProcessor(1, config as never);
    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    idempotencyKey: buildOnboardingReminderIdempotencyKey({
                      accountId: ACCOUNT_ID,
                      offsetDays: 1,
                    }),
                  },
                ]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    accountId: ACCOUNT_ID,
                    accountEmail: 'carer@example.test',
                    accountStatus: 'incomplete',
                    onboardingCompletedAt: new Date(),
                    staffId: STAFF_ID,
                    staffEmail: 'carer@example.test',
                    legalFirstName: 'Alex',
                  },
                ]),
              }),
            }),
          }),
        };
      }),
    };

    const outcome = await processor.evaluate(db as never, {
      scheduledCommunicationId: 'comm-1',
    });
    expect(outcome).toEqual({ kind: 'stale' });
  });
});
