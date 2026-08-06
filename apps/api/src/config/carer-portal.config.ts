/** Parse CARER_PORTAL_ENABLED (default false — carer UI/API off until Phase 1+ staging). */
export function parseCarerPortalEnabled(value: unknown): boolean {
  return String(value ?? 'false').trim().toLowerCase() === 'true';
}
