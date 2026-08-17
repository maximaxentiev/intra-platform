import type { CarerSession } from "./carer";
import { CARER_ONBOARDING_STEPS, type CarerOnboardingStepPath } from "./carer-onboarding";

export type HubStepNumber = 1 | 2 | 3;

export const CARER_ONBOARDING_HUB_PATH = "/carer/onboarding" as const;

export function countCompletedHubSteps(
  session: Pick<CarerSession, "profileComplete" | "documentsComplete" | "availabilityComplete">,
): number {
  let count = 0;
  if (session.profileComplete) count++;
  if (session.documentsComplete) count++;
  if (session.availabilityComplete) count++;
  return count;
}

/** Why a hub step CTA is blocked, or null when the step may be opened. */
export function hubStepLockedReason(
  step: HubStepNumber,
  session: Pick<CarerSession, "profileComplete" | "documentsComplete">,
): string | null {
  if (step === 1) return null;
  if (!session.profileComplete) return "Complete Step 1 first";
  if (step === 2) return null;
  if (!session.documentsComplete) return "Complete Step 2 first";
  return null;
}

export function hubStepAccessible(
  step: HubStepNumber,
  session: Pick<CarerSession, "profileComplete" | "documentsComplete">,
): boolean {
  return hubStepLockedReason(step, session) === null;
}

export type HubStepCardModel = {
  step: HubStepNumber;
  label: string;
  title: string;
  path: CarerOnboardingStepPath;
  complete: boolean;
  lockedReason: string | null;
  ctaLabel: string;
};

const STEP_CTA = {
  1: { incomplete: "Complete personal information", complete: "Edit personal information" },
  2: { incomplete: "Complete documents", complete: "Manage documents" },
  3: { incomplete: "Complete availability", complete: "Edit availability" },
} as const;

export function buildHubStepCards(
  session: Pick<
    CarerSession,
    "profileComplete" | "documentsComplete" | "availabilityComplete" | "profileCompletedAt" | "documentsCompletedAt"
  >,
): HubStepCardModel[] {
  return CARER_ONBOARDING_STEPS.map(({ step, path, title }) => {
    const stepNum = step as HubStepNumber;
    const complete =
      stepNum === 1
        ? session.profileComplete
        : stepNum === 2
          ? session.documentsComplete
          : session.availabilityComplete;
    const lockedReason = hubStepLockedReason(stepNum, session);
    const cta = STEP_CTA[stepNum];
    return {
      step: stepNum,
      label: `Step ${stepNum}`,
      title,
      path,
      complete,
      lockedReason,
      ctaLabel: lockedReason ?? (complete ? cta.complete : cta.incomplete),
    };
  });
}

export function mapOnboardingCompleteError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (/personal information/i.test(message)) {
    return "Complete your personal information before finishing onboarding.";
  }
  if (/documents/i.test(message)) {
    return "Complete your documents before finishing onboarding.";
  }
  if (/availability step/i.test(message)) {
    return "Complete your availability step before finishing onboarding.";
  }
  if (/session expired|401/i.test(message)) {
    return "Your session expired. Sign in again to continue.";
  }
  return message || fallback;
}
