export type StaffPortalOnboardingStatusDto = {
  profileComplete: boolean;
  profileCompletedAt: string | null;

  documentsComplete: boolean;
  documentsCompletedAt: string | null;

  availabilityComplete: boolean;
  availabilityCompletedAt: string | null;

  onboardingComplete: boolean;
  onboardingCompletedAt: string | null;

  canCompleteOnboarding: boolean;

  onboardingStep: number;

  onboardingStartedAt: string | null;
};
