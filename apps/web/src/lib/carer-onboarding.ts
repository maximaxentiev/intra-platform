import type { CarerSession } from "./carer";

export type CarerOnboardingStepPath =
  | "/carer/onboarding/profile"
  | "/carer/onboarding/documents"
  | "/carer/onboarding/availability";

export type CarerOnboardingPath =
  | typeof CARER_ONBOARDING_INTRO_PATH
  | CarerOnboardingStepPath;

export const CARER_ONBOARDING_INTRO_PATH = "/carer/onboarding/intro" as const;

/** @deprecated Hub redirects to intro or resume step; retained for legacy test references. */
export const CARER_ONBOARDING_HUB_PATH = "/carer/onboarding" as const;

export const CARER_ONBOARDING_STEPS = [
  { step: 1, path: "/carer/onboarding/profile" as const, title: "Personal information" },
  { step: 2, path: "/carer/onboarding/documents" as const, title: "Documents" },
  { step: 3, path: "/carer/onboarding/availability" as const, title: "Availability" },
];

export function onboardingComplete(
  session: Pick<CarerSession, "onboardingComplete" | "onboardingCompletedAt">,
): boolean {
  return session.onboardingComplete ?? Boolean(session.onboardingCompletedAt);
}

export function onboardingStarted(
  session: Pick<CarerSession, "onboardingStartedAt">,
): boolean {
  return Boolean(session.onboardingStartedAt);
}

/** Resume incomplete onboarding at intro or the furthest legitimate step. */
export function carerOnboardingResumePath(
  session: Pick<
    CarerSession,
    "onboardingStartedAt" | "profileCompletedAt" | "documentsCompletedAt" | "availabilityCompletedAt"
  >,
): CarerOnboardingPath {
  if (!onboardingStarted(session)) {
    return CARER_ONBOARDING_INTRO_PATH;
  }
  if (!session.profileCompletedAt) {
    return "/carer/onboarding/profile";
  }
  if (!session.documentsCompletedAt) {
    return "/carer/onboarding/documents";
  }
  return "/carer/onboarding/availability";
}

export function carerLandingPath(
  session: Pick<
    CarerSession,
    | "onboardingComplete"
    | "onboardingCompletedAt"
    | "onboardingStartedAt"
    | "profileCompletedAt"
    | "documentsCompletedAt"
    | "availabilityCompletedAt"
  >,
): "/carer" | CarerOnboardingPath {
  return onboardingComplete(session) ? "/carer" : carerOnboardingResumePath(session);
}

/** Highest step number the user may open directly in the URL bar. */
export function maxAccessibleOnboardingStep(
  session: Pick<CarerSession, "onboardingStartedAt" | "profileCompletedAt" | "onboardingStep">,
): number {
  if (!onboardingStarted(session)) return 0;
  if (!session.profileCompletedAt) return 1;
  return Math.max(2, Math.min(session.onboardingStep, 3));
}

export function stepPathForNumber(step: number): CarerOnboardingStepPath {
  const found = CARER_ONBOARDING_STEPS.find((s) => s.step === step);
  return found?.path ?? "/carer/onboarding/profile";
}

export function requiredStepForPath(path: CarerOnboardingStepPath): number {
  const found = CARER_ONBOARDING_STEPS.find((s) => s.path === path);
  return found?.step ?? 1;
}
