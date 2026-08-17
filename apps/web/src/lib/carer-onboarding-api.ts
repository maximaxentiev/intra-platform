import { api } from "@/lib/api";

/** Mirrors POST /staff-portal/onboarding/complete and availability step status DTO. */
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
};

export const carerOnboardingApi = {
  complete: () => api.post<CarerOnboardingStatus>("/staff-portal/onboarding/complete"),
};
