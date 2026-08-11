import type { CarerSession } from "./carer";
import { carerLandingPath } from "./carer-onboarding";

export const CARER_LOGIN_PATH = "/carer/login" as const;

/** Where to send users who open an unusable invite link (carer session only). */
export async function resolveUnusableInviteRedirect(deps: {
  getSession: () => Promise<CarerSession>;
  landingPath?: (session: CarerSession) => string;
}): Promise<string> {
  const landingPath = deps.landingPath ?? carerLandingPath;
  try {
    const session = await deps.getSession();
    return landingPath(session);
  } catch {
    return CARER_LOGIN_PATH;
  }
}
