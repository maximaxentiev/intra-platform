import type { CarerSession } from "./carer";

/** Test helper — mirrors authoritative session fields from GET /staff-auth/session. */
export function carerSessionFixture(
  overrides: Partial<CarerSession> = {},
): CarerSession {
  const profileCompletedAt = overrides.profileCompletedAt ?? null;
  const documentsCompletedAt = overrides.documentsCompletedAt ?? null;
  const availabilityCompletedAt = overrides.availabilityCompletedAt ?? null;
  const onboardingCompletedAt = overrides.onboardingCompletedAt ?? null;

  const profileComplete = overrides.profileComplete ?? Boolean(profileCompletedAt);
  const documentsComplete = overrides.documentsComplete ?? Boolean(documentsCompletedAt);
  const availabilityComplete =
    overrides.availabilityComplete ??
    Boolean(availabilityCompletedAt ?? onboardingCompletedAt);
  const onboardingComplete =
    overrides.onboardingComplete ?? Boolean(onboardingCompletedAt);
  const canCompleteOnboarding =
    overrides.canCompleteOnboarding ??
    (profileComplete && documentsComplete && availabilityComplete && !onboardingComplete);

  return {
    accountId: "a",
    staffId: "s",
    email: "c@example.test",
    status: "incomplete",
    onboardingStep: 1,
    profileCompletedAt,
    documentsCompletedAt,
    availabilityCompletedAt,
    onboardingCompletedAt,
    legalFirstName: "A",
    legalLastName: "B",
    phone: "1",
    address: "1",
    city: "C",
    ...overrides,
    onboardingStartedAt: overrides.onboardingStartedAt ?? null,
    profileComplete,
    documentsComplete,
    availabilityComplete,
    onboardingComplete,
    canCompleteOnboarding,
  };
}
