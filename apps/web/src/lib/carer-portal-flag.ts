/**
 * Carer portal feature flag (build-time via Vite).
 * Must match API CARER_PORTAL_ENABLED on each environment.
 */
export function isCarerPortalEnabled(): boolean {
  return import.meta.env.VITE_CARER_PORTAL_ENABLED === "true";
}
