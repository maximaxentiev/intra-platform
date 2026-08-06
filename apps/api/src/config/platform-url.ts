/**
 * Canonical public URL for the ops platform (emails, auth redirects, CORS helpers).
 * Prefer APP_PUBLIC_URL; fall back to https://${APP_HOST} in production.
 */

export const AUTH_APP_PATHS = {
  login: '/auth',
  verifyEmail: '/auth/verify-email',
  resetPassword: '/auth/reset-password',
  acceptInvite: '/auth/accept-invite',
} as const;

export type PlatformUrlEnv = {
  APP_PUBLIC_URL?: string;
  APP_HOST?: string;
  LEGACY_APP_HOST?: string;
  NODE_ENV?: string;
};

export function normalizePublicUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Public platform URL must not be empty.');
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function resolvePublicPlatformUrl(env: PlatformUrlEnv): string {
  const explicit = env.APP_PUBLIC_URL?.trim();
  if (explicit) {
    return normalizePublicUrl(explicit);
  }
  const host = env.APP_HOST?.trim();
  if (host) {
    const bare = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return `https://${bare}`;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('APP_PUBLIC_URL or APP_HOST is required when NODE_ENV=production.');
  }
  return 'http://localhost:8080';
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ensures production CORS includes the canonical public origin (and optional legacy host). */
export function mergeProductionCorsOrigins(
  configured: string[],
  env: PlatformUrlEnv,
): string[] {
  const merged = new Set(configured);
  const publicUrl = resolvePublicPlatformUrl(env);
  merged.add(publicUrl);
  const legacy = env.LEGACY_APP_HOST?.trim();
  if (legacy) {
    const legacyHost = legacy.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    merged.add(`https://${legacyHost}`);
  }
  return [...merged];
}

export function buildPlatformLink(publicBase: string, path: string): string {
  const base = normalizePublicUrl(publicBase);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function buildAuthRedirectUrl(publicBase: string, path: keyof typeof AUTH_APP_PATHS): string {
  return buildPlatformLink(publicBase, AUTH_APP_PATHS[path]);
}

const LOCALHOST_PATTERN = /(^|\.)localhost\b|127\.0\.0\.1/i;

/** Block accidental localhost / legacy staging URLs in production-generated outbound links. */
export function assertProductionOutboundUrl(url: string, env: PlatformUrlEnv): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  const canonical = resolvePublicPlatformUrl(env);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid outbound URL in production: ${url}`);
  }
  if (LOCALHOST_PATTERN.test(parsed.hostname)) {
    throw new Error(`Production outbound URL must not use localhost: ${url}`);
  }
  const legacy = env.LEGACY_APP_HOST?.trim().replace(/^https?:\/\//i, '').split('/')[0];
  if (legacy && parsed.hostname === legacy) {
    throw new Error(
      `Production outbound URL must use the canonical platform host (${canonical}), not legacy: ${url}`,
    );
  }
}

/** Traefik redirectRegex replacement target for legacy host → canonical (path preserved). */
export function legacyRedirectReplacement(appHost: string): string {
  const host = appHost.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${host}/$1`;
}

export function legacyRedirectRegex(): string {
  return '^https?://[^/]+/?(.*)$';
}
