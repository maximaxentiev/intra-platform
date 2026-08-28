import { api } from "@/lib/api";

/** Mirrors staff-portal onboarding status DTO. */
export type CarerOnboardingStatus = {
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

export const carerOnboardingApi = {
  start: () => api.post<CarerOnboardingStatus>("/staff-portal/onboarding/start"),
  complete: () => api.post<CarerOnboardingStatus>("/staff-portal/onboarding/complete"),
};
