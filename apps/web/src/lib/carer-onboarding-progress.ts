/** Persisted onboarding fields used to derive step completion in the progress shell. */
export type OnboardingProgressContext = {
  /** Step number of the page currently being viewed (1–3). */
  activeStep: number;
  profileCompletedAt: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
};

export type OnboardingStepDisplayState = "complete" | "current" | "locked";

export function countCompletedOnboardingSteps(
  ctx: Pick<
    OnboardingProgressContext,
    "profileCompletedAt" | "onboardingStep" | "onboardingCompletedAt"
  >,
): number {
  let count = 0;
  if (ctx.profileCompletedAt) count++;
  if (ctx.onboardingStep >= 3) count++;
  if (ctx.onboardingCompletedAt) count++;
  return count;
}

/** Completion is derived from persisted state, not from the active route alone. */
export function resolveOnboardingStepDisplayState(
  stepNumber: number,
  ctx: OnboardingProgressContext,
): OnboardingStepDisplayState {
  if (stepNumber === 1 && ctx.profileCompletedAt) return "complete";
  if (stepNumber === 2 && ctx.onboardingStep >= 3) return "complete";
  if (stepNumber === 3 && ctx.onboardingCompletedAt) return "complete";

  if (stepNumber === 1 && !ctx.profileCompletedAt) return "current";

  if (stepNumber === 2) {
    if (!ctx.profileCompletedAt) return "locked";
    return "current";
  }

  if (stepNumber === 3) {
    if (ctx.onboardingStep < 3) return "locked";
    return "current";
  }

  return "locked";
}

export function onboardingStepStateLabel(
  state: OnboardingStepDisplayState,
  stepNumber: number,
  activeStep: number,
): string {
  if (state === "complete") return "Completed";
  if (state === "locked") return "Locked";
  if (stepNumber > activeStep) return "Next step";
  return "In progress";
}
