import { redirect } from "@tanstack/react-router";
import { carerAuthApi } from "@/lib/carer";
import {
  CARER_ONBOARDING_HUB_PATH,
  maxAccessibleOnboardingStep,
  onboardingComplete,
  requiredStepForPath,
  type CarerOnboardingStepPath,
} from "@/lib/carer-onboarding";

/** Require carer session; redirect incomplete users away from the full portal. */
export async function requireCarerSessionForPortal() {
  let session;
  try {
    session = await carerAuthApi.session();
  } catch {
    throw redirect({ to: "/carer/login", replace: true });
  }
  if (!onboardingComplete(session)) {
    throw redirect({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
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

/** Block URL skipping ahead of completed onboarding steps. */
export function assertOnboardingStepAccess(
  session: Awaited<ReturnType<typeof requireCarerSessionForOnboarding>>,
  path: CarerOnboardingStepPath,
) {
  const required = requiredStepForPath(path);
  const allowed = maxAccessibleOnboardingStep(session);
  if (required > allowed) {
    throw redirect({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
  }
}
