import type { CommunicationType } from '../automated-communications/automated-communications.types';

/** Elapsed calendar-day milestones after the first portal invitation anchor date. */
export const ONBOARDING_REMINDER_OFFSETS_DAYS = [1, 3, 7, 14, 30] as const;

export type OnboardingReminderOffsetDays = (typeof ONBOARDING_REMINDER_OFFSETS_DAYS)[number];

export const ONBOARDING_REMINDER_COMMUNICATION_TYPE: Record<
  OnboardingReminderOffsetDays,
  CommunicationType
> = {
  1: 'onboarding_reminder_1d',
  3: 'onboarding_reminder_3d',
  7: 'onboarding_reminder_7d',
  14: 'onboarding_reminder_14d',
  30: 'onboarding_reminder_30d',
};

export const ALL_ONBOARDING_REMINDER_COMMUNICATION_TYPES = Object.values(
  ONBOARDING_REMINDER_COMMUNICATION_TYPE,
);

const IDEMPOTENCY_PREFIX = 'staff_account:';

export function buildOnboardingReminderIdempotencyKey(params: {
  accountId: string;
  offsetDays: OnboardingReminderOffsetDays;
}): string {
  return `${IDEMPOTENCY_PREFIX}${params.accountId}:onboarding_reminder:${params.offsetDays}d`;
}

export function parseOnboardingReminderIdempotencyKey(
  key: string,
): { accountId: string; offsetDays: OnboardingReminderOffsetDays } | null {
  const match = /^staff_account:([0-9a-f-]{36}):onboarding_reminder:(1|3|7|14|30)d$/.exec(key);
  if (!match) return null;
  return {
    accountId: match[1]!,
    offsetDays: Number(match[2]) as OnboardingReminderOffsetDays,
  };
}

export function communicationTypeForOnboardingOffset(
  offsetDays: OnboardingReminderOffsetDays,
): CommunicationType {
  return ONBOARDING_REMINDER_COMMUNICATION_TYPE[offsetDays];
}
