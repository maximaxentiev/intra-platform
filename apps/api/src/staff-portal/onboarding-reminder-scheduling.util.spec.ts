import { describe, expect, it, vi } from 'vitest';
import {
  planFutureOnboardingReminders,
  portalInvitationAnchorDate,
  torontoOnboardingReminderInstant,
} from './onboarding-reminder-scheduling.util';
import {
  buildOnboardingReminderIdempotencyKey,
  parseOnboardingReminderIdempotencyKey,
} from './onboarding-reminder.types';

describe('onboarding reminder scheduling', () => {
  const anchor = '2026-09-01';

  it('maps anchor Sep 1 to milestone instants at 09:00 Toronto', () => {
    expect(torontoOnboardingReminderInstant(anchor, 1).toISOString()).toBe(
      '2026-09-02T13:00:00.000Z',
    );
    expect(torontoOnboardingReminderInstant(anchor, 3).toISOString()).toBe(
      '2026-09-04T13:00:00.000Z',
    );
    expect(torontoOnboardingReminderInstant(anchor, 7).toISOString()).toBe(
      '2026-09-08T13:00:00.000Z',
    );
    expect(torontoOnboardingReminderInstant(anchor, 14).toISOString()).toBe(
      '2026-09-15T13:00:00.000Z',
    );
    expect(torontoOnboardingReminderInstant(anchor, 30).toISOString()).toBe(
      '2026-10-01T13:00:00.000Z',
    );
  });

  it('crosses month and year boundaries', () => {
    expect(torontoOnboardingReminderInstant('2026-01-30', 1).toISOString()).toBe(
      '2026-01-31T14:00:00.000Z',
    );
    expect(torontoOnboardingReminderInstant('2025-12-05', 30).toISOString()).toBe(
      '2026-01-04T14:00:00.000Z',
    );
  });

  it('derives anchor date from account createdAt in Toronto', () => {
    expect(portalInvitationAnchorDate(new Date('2026-09-01T16:00:00.000Z'))).toBe('2026-09-01');
    expect(portalInvitationAnchorDate(new Date('2026-09-02T03:00:00.000Z'))).toBe('2026-09-01');
  });

  it('planFutureOnboardingReminders omits past milestones (no backfill)', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    const plans = planFutureOnboardingReminders(anchor, now);
    expect(plans.map((p) => p.offsetDays)).toEqual([7, 14, 30]);
  });

  it('planFutureOnboardingReminders returns nothing when all milestones passed', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    expect(planFutureOnboardingReminders(anchor, now)).toEqual([]);
  });
});

describe('onboarding reminder idempotency keys', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';

  it('builds and parses stable keys per milestone', () => {
    const key = buildOnboardingReminderIdempotencyKey({ accountId, offsetDays: 7 });
    expect(key).toBe(`staff_account:${accountId}:onboarding_reminder:7d`);
    expect(parseOnboardingReminderIdempotencyKey(key)).toEqual({ accountId, offsetDays: 7 });
  });
});

describe('onboarding reminder email template', () => {
  it('includes required copy and CTA without sensitive internals', async () => {
    const { buildOnboardingReminderEmailContent, onboardingReminderEmailContainsNoSensitiveInternals } =
      await import('./onboarding-reminder-email.template');

    const content = buildOnboardingReminderEmailContent({
      legalFirstName: 'Alex',
      platformEnv: { APP_PUBLIC_URL: 'https://platform.intra.ca', NODE_ENV: 'test' },
    });

    expect(content.subject).toBe('Complete your Intra onboarding');
    expect(content.text).toMatch(/not complete yet/i);
    expect(content.text).toMatch(/Shift opportunities/i);
    expect(content.text).toMatch(/5–10 minutes|5-10 minutes/i);
    expect(content.text).toContain('https://platform.intra.ca/carer/login');
    expect(content.html).toContain('Complete onboarding');
    expect(content.html).toContain('Very best,');
    expect(onboardingReminderEmailContainsNoSensitiveInternals(content)).toBe(true);
  });
});
