import { describe, expect, it } from 'vitest';
import {
  buildStaffPortalOnboardingStatus,
  isAvailabilityStepComplete,
} from './staff-portal-onboarding-status.util';

describe('staff-portal-onboarding-status.util', () => {
  const base = {
    profileCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
    documentsCompletedAt: new Date('2026-01-02T12:00:00.000Z'),
    availabilityCompletedAt: null as Date | null,
    onboardingCompletedAt: null as Date | null,
    onboardingStep: 3,
  };

  it('derives availabilityComplete from availabilityCompletedAt', () => {
    const status = buildStaffPortalOnboardingStatus({
      ...base,
      availabilityCompletedAt: new Date('2026-01-03T12:00:00.000Z'),
    });
    expect(status.availabilityComplete).toBe(true);
    expect(status.canCompleteOnboarding).toBe(true);
  });

  it('derives availabilityComplete from legacy onboardingCompletedAt fallback', () => {
    expect(
      isAvailabilityStepComplete({
        availabilityCompletedAt: null,
        onboardingCompletedAt: new Date('2026-02-01T12:00:00.000Z'),
      }),
    ).toBe(true);

    const status = buildStaffPortalOnboardingStatus({
      ...base,
      onboardingCompletedAt: new Date('2026-02-01T12:00:00.000Z'),
    });
    expect(status.availabilityComplete).toBe(true);
    expect(status.onboardingComplete).toBe(true);
    expect(status.canCompleteOnboarding).toBe(false);
  });

  it('canCompleteOnboarding requires all three steps and no final completion', () => {
    const incomplete = buildStaffPortalOnboardingStatus({
      ...base,
      documentsCompletedAt: null,
    });
    expect(incomplete.documentsComplete).toBe(false);
    expect(incomplete.canCompleteOnboarding).toBe(false);

    const ready = buildStaffPortalOnboardingStatus({
      ...base,
      availabilityCompletedAt: new Date('2026-01-03T12:00:00.000Z'),
    });
    expect(ready.canCompleteOnboarding).toBe(true);
  });

  it('does not infer documents or availability completion from onboardingStep alone', () => {
    const status = buildStaffPortalOnboardingStatus({
      profileCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
      documentsCompletedAt: null,
      availabilityCompletedAt: null,
      onboardingCompletedAt: null,
      onboardingStep: 3,
    });
    expect(status.documentsComplete).toBe(false);
    expect(status.availabilityComplete).toBe(false);
    expect(status.canCompleteOnboarding).toBe(false);
  });
});
