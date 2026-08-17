import type { CarerSession } from "./carer";

/** Persisted onboarding fields used to derive step completion in the progress shell. */
export type OnboardingProgressContext = {
  /** Step number of the page currently being viewed (1–3). */
  activeStep: number;
  profileComplete: boolean;
  documentsComplete: boolean;
  availabilityComplete: boolean;
  profileCompletedAt: string | null;
  onboardingStep: number;
};

export type OnboardingStepDisplayState = "complete" | "current" | "locked";

export function countCompletedOnboardingSteps(
  session: Pick<CarerSession, "profileComplete" | "documentsComplete" | "availabilityComplete">,
): number {
  let count = 0;
  if (session.profileComplete) count++;
  if (session.documentsComplete) count++;
  if (session.availabilityComplete) count++;
  return count;
}

/** Completion is derived from authoritative session flags, not route history. */
export function resolveOnboardingStepDisplayState(
  stepNumber: number,
  ctx: OnboardingProgressContext,
): OnboardingStepDisplayState {
  if (stepNumber === 1 && ctx.profileComplete) return "complete";
  if (stepNumber === 2 && ctx.documentsComplete) return "complete";
  if (stepNumber === 3 && ctx.availabilityComplete) return "complete";

  if (stepNumber === 1 && !ctx.profileComplete) return "current";

  if (stepNumber === 2) {
    if (!ctx.profileComplete) return "locked";
    return "current";
  }

  if (stepNumber === 3) {
    if (!ctx.documentsComplete) return "locked";
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
