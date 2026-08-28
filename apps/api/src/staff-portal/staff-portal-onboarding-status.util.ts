import type { StaffPortalOnboardingStatusDto } from './dto/staff-portal-onboarding.dto';

/** Persisted staff account fields used to derive onboarding status. */
export type StaffAccountOnboardingFields = {
  profileCompletedAt: Date | null;
  documentsCompletedAt: Date | null;
  availabilityCompletedAt: Date | null;
  onboardingCompletedAt: Date | null;
  onboardingStartedAt: Date | null;
  onboardingStep: number;
};

/** Read-time fallback: legacy fully onboarded accounts before availability_completed_at backfill. */
export function isAvailabilityStepComplete(
  account: Pick<StaffAccountOnboardingFields, 'availabilityCompletedAt' | 'onboardingCompletedAt'>,
): boolean {
  return Boolean(account.availabilityCompletedAt ?? account.onboardingCompletedAt);
}

export function buildStaffPortalOnboardingStatus(
  account: StaffAccountOnboardingFields,
): StaffPortalOnboardingStatusDto {
  const profileComplete = Boolean(account.profileCompletedAt);
  const documentsComplete = Boolean(account.documentsCompletedAt);
  const availabilityComplete = isAvailabilityStepComplete(account);
  const onboardingComplete = Boolean(account.onboardingCompletedAt);

  return {
    profileComplete,
    profileCompletedAt: account.profileCompletedAt?.toISOString() ?? null,
    documentsComplete,
    documentsCompletedAt: account.documentsCompletedAt?.toISOString() ?? null,
    availabilityComplete,
    availabilityCompletedAt: account.availabilityCompletedAt?.toISOString() ?? null,
    onboardingComplete,
    onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() ?? null,
    canCompleteOnboarding:
      profileComplete && documentsComplete && availabilityComplete && !onboardingComplete,
    onboardingStep: account.onboardingStep,
    onboardingStartedAt: account.onboardingStartedAt?.toISOString() ?? null,
  };
}
