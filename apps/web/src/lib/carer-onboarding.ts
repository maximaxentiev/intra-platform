import type { CarerSession } from "./carer";

export type CarerOnboardingStepPath =
  | "/carer/onboarding/profile"
  | "/carer/onboarding/documents"
  | "/carer/onboarding/availability";

export const CARER_ONBOARDING_STEPS = [
  { step: 1, path: "/carer/onboarding/profile" as const, title: "Personal Information" },
  { step: 2, path: "/carer/onboarding/documents" as const, title: "Documents" },
  { step: 3, path: "/carer/onboarding/availability" as const, title: "Availability" },
];

export function onboardingComplete(session: Pick<CarerSession, "onboardingCompletedAt">): boolean {
  return Boolean(session.onboardingCompletedAt);
}

/** Resume URL for incomplete onboarding (never the full portal). */
export function carerOnboardingResumePath(
  session: Pick<CarerSession, "profileCompletedAt" | "onboardingStep">,
): CarerOnboardingStepPath {
  if (!session.profileCompletedAt) return "/carer/onboarding/profile";
  if (session.onboardingStep >= 3) return "/carer/onboarding/availability";
  return "/carer/onboarding/documents";
}

export function carerLandingPath(
  session: Pick<CarerSession, "onboardingCompletedAt" | "profileCompletedAt" | "onboardingStep">,
): "/carer" | CarerOnboardingStepPath {
  return onboardingComplete(session) ? "/carer" : carerOnboardingResumePath(session);
}

/** Highest step number the user may open directly in the URL bar. */
export function maxAccessibleOnboardingStep(session: Pick<
  CarerSession,
  "profileCompletedAt" | "onboardingStep"
>): number {
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

/** Earlier unlocked steps remain navigable; future locked steps are not. */
export function isOnboardingStepNavigable(
  stepNumber: number,
  activeStep: number,
  session: Pick<CarerSession, "profileCompletedAt" | "onboardingStep">,
): boolean {
  if (stepNumber === activeStep) return false;
  return stepNumber <= maxAccessibleOnboardingStep(session);
}
