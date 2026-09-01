import {
  assertProductionOutboundUrl,
  buildAuthRedirectUrl,
  buildPlatformLink,
  resolvePublicPlatformUrl,
  type PlatformUrlEnv,
} from './platform-url';

/** Links for outbound email — always rooted at the canonical public URL in production. */
export function buildEmailVerificationLink(token: string, env: PlatformUrlEnv): string {
  const base = resolvePublicPlatformUrl(env);
  const url = `${buildAuthRedirectUrl(base, 'verifyEmail')}?token=${encodeURIComponent(token)}`;
  assertProductionOutboundUrl(url, env);
  return url;
}

export function buildPasswordResetEmailLink(token: string, env: PlatformUrlEnv): string {
  const base = resolvePublicPlatformUrl(env);
  const url = `${buildAuthRedirectUrl(base, 'resetPassword')}?token=${encodeURIComponent(token)}`;
  assertProductionOutboundUrl(url, env);
  return url;
}

export function buildStaffInviteEmailLink(inviteToken: string, env: PlatformUrlEnv): string {
  const base = resolvePublicPlatformUrl(env);
  const path = `/carer/invite/${encodeURIComponent(inviteToken)}`;
  const url = buildPlatformLink(base, path);
  assertProductionOutboundUrl(url, env);
  return url;
}

export function buildStaffPasswordResetEmailLink(resetToken: string, env: PlatformUrlEnv): string {
  const base = resolvePublicPlatformUrl(env);
  const path = `/carer/reset-password/${encodeURIComponent(resetToken)}`;
  const url = buildPlatformLink(base, path);
  assertProductionOutboundUrl(url, env);
  return url;
}

export function buildGenericPlatformEmailLink(path: string, env: PlatformUrlEnv): string {
  const base = resolvePublicPlatformUrl(env);
  const url = buildPlatformLink(base, path);
  assertProductionOutboundUrl(url, env);
  return url;
}

export function buildCarerShiftDetailLink(shiftId: string, env: PlatformUrlEnv): string {
  const path = `/carer/shifts/${encodeURIComponent(shiftId)}`;
  return buildGenericPlatformEmailLink(path, env);
}

export function buildCarerDocumentsLink(env: PlatformUrlEnv): string {
  return buildGenericPlatformEmailLink('/carer/documents', env);
}

/** Public HTTPS URL for the Intra logo in outbound HTML email. */
export function buildIntraEmailLogoUrl(env: PlatformUrlEnv): string {
  const url = buildGenericPlatformEmailLink('/intra-logo-purple.png', env);
  assertProductionOutboundUrl(url, env);
  return url;
}
