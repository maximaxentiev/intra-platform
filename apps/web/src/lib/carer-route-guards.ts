import { redirect } from "@tanstack/react-router";
import { carerAuthApi } from "@/lib/carer";
import {
  CARER_ONBOARDING_INTRO_PATH,
  carerOnboardingResumePath,
  maxAccessibleOnboardingStep,
  onboardingComplete,
  onboardingStarted,
  requiredStepForPath,
  type CarerOnboardingStepPath,
} from "@/lib/carer-onboarding";

/** Require carer session; redirect incomplete users into onboarding. */
export async function requireCarerSessionForPortal() {
  let session;
  try {
    session = await carerAuthApi.session();
  } catch {
    throw redirect({ to: "/carer/login", replace: true });
  }
  if (!onboardingComplete(session)) {
    throw redirect({ to: carerOnboardingResumePath(session), replace: true });
  }
  return session;
}

/** Require carer session for onboarding routes; send finished users to the portal home. */
export async function requireCarerSessionForOnboarding() {
  let session;
  try {
    session = await carerAuthApi.session();
  } catch {
    throw redirect({ to: "/carer/login", replace: true });
  }
  if (onboardingComplete(session)) {
    throw redirect({ to: "/carer", replace: true });
  }
  return session;
}

/** Intro screen — only before onboarding has started. */
export function assertOnboardingIntroAccess(
  session: Awaited<ReturnType<typeof requireCarerSessionForOnboarding>>,
) {
  if (onboardingStarted(session)) {
    throw redirect({ to: carerOnboardingResumePath(session), replace: true });
  }
}

/** Step routes — onboarding must have started. */
export function assertOnboardingStarted(
  session: Awaited<ReturnType<typeof requireCarerSessionForOnboarding>>,
) {
  if (!onboardingStarted(session)) {
    throw redirect({ to: CARER_ONBOARDING_INTRO_PATH, replace: true });
  }
}

/** Block URL skipping ahead of completed onboarding steps. */
export function assertOnboardingStepAccess(
  session: Awaited<ReturnType<typeof requireCarerSessionForOnboarding>>,
  path: CarerOnboardingStepPath,
) {
  assertOnboardingStarted(session);
  const required = requiredStepForPath(path);
  const allowed = maxAccessibleOnboardingStep(session);
  if (required > allowed) {
    throw redirect({ to: carerOnboardingResumePath(session), replace: true });
  }
}
