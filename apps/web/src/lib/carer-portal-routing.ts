/**
 * Routing policy when the carer portal feature flag is off.
 * Disabled carer URLs must never redirect into the ops /auth flow (which auto-enters
 * an existing operations session and looks like the invite logged the user in as ops).
 */
export type CarerPortalParentBehavior = "allow-children" | "show-unavailable";

export function carerPortalParentBehavior(carerPortalEnabled: boolean): CarerPortalParentBehavior {
  return carerPortalEnabled ? "allow-children" : "show-unavailable";
}
