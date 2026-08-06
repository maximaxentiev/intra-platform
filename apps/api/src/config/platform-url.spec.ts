import { describe, expect, it } from 'vitest';
import {
  AUTH_APP_PATHS,
  assertProductionOutboundUrl,
  buildAuthRedirectUrl,
  buildPlatformLink,
  legacyRedirectRegex,
  legacyRedirectReplacement,
  mergeProductionCorsOrigins,
  normalizePublicUrl,
  parseCorsOrigins,
  resolvePublicPlatformUrl,
} from './platform-url';

describe('resolvePublicPlatformUrl', () => {
  it('prefers APP_PUBLIC_URL with scheme', () => {
    expect(
      resolvePublicPlatformUrl({
        APP_PUBLIC_URL: 'https://platform.intra.ca',
        APP_HOST: 'ops-test.intra.ca',
        NODE_ENV: 'production',
      }),
    ).toBe('https://platform.intra.ca');
  });

  it('adds https when APP_PUBLIC_URL is host-only', () => {
    expect(
      resolvePublicPlatformUrl({ APP_PUBLIC_URL: 'platform.intra.ca', NODE_ENV: 'production' }),
    ).toBe('https://platform.intra.ca');
  });

  it('derives from APP_HOST in production', () => {
    expect(
      resolvePublicPlatformUrl({ APP_HOST: 'platform.intra.ca', NODE_ENV: 'production' }),
    ).toBe('https://platform.intra.ca');
  });

  it('defaults to localhost in development', () => {
    expect(resolvePublicPlatformUrl({ NODE_ENV: 'development' })).toBe('http://localhost:8080');
  });

  it('throws in production without URL config', () => {
    expect(() => resolvePublicPlatformUrl({ NODE_ENV: 'production' })).toThrow(/APP_PUBLIC_URL/);
  });
});

describe('parseCorsOrigins', () => {
  it('splits comma-separated origins', () => {
    expect(parseCorsOrigins('https://platform.intra.ca, https://ops-test.intra.ca')).toEqual([
      'https://platform.intra.ca',
      'https://ops-test.intra.ca',
    ]);
  });
});

describe('mergeProductionCorsOrigins', () => {
  it('includes canonical and legacy hosts', () => {
    const env = {
      APP_PUBLIC_URL: 'https://platform.intra.ca',
      LEGACY_APP_HOST: 'ops-test.intra.ca',
      NODE_ENV: 'production',
    };
    expect(mergeProductionCorsOrigins([], env).sort()).toEqual(
      ['https://ops-test.intra.ca', 'https://platform.intra.ca'].sort(),
    );
  });
});

describe('buildPlatformLink and auth redirects', () => {
  const base = 'https://platform.intra.ca';

  it('builds email-safe links without trailing slash on base', () => {
    expect(buildPlatformLink('https://platform.intra.ca/', '/auth/reset-password')).toBe(
      'https://platform.intra.ca/auth/reset-password',
    );
  });

  it('builds auth redirect URLs from paths', () => {
    expect(buildAuthRedirectUrl(base, 'login')).toBe(`${base}${AUTH_APP_PATHS.login}`);
    expect(buildAuthRedirectUrl(base, 'verifyEmail')).toBe(`${base}${AUTH_APP_PATHS.verifyEmail}`);
    expect(buildAuthRedirectUrl(base, 'resetPassword')).toBe(`${base}${AUTH_APP_PATHS.resetPassword}`);
    expect(buildAuthRedirectUrl(base, 'acceptInvite')).toBe(`${base}${AUTH_APP_PATHS.acceptInvite}`);
  });
});

describe('assertProductionOutboundUrl', () => {
  const prodEnv = {
    APP_PUBLIC_URL: 'https://platform.intra.ca',
    LEGACY_APP_HOST: 'ops-test.intra.ca',
    NODE_ENV: 'production',
  };

  it('allows canonical platform links', () => {
    expect(() =>
      assertProductionOutboundUrl('https://platform.intra.ca/auth/verify-email?token=x', prodEnv),
    ).not.toThrow();
  });

  it('rejects localhost in production', () => {
    expect(() =>
      assertProductionOutboundUrl('http://localhost:8080/auth', prodEnv),
    ).toThrow(/localhost/);
  });

  it('rejects legacy ops-test URLs in production-generated links', () => {
    expect(() =>
      assertProductionOutboundUrl('https://ops-test.intra.ca/auth/reset-password', prodEnv),
    ).toThrow(/legacy/);
  });
});

describe('legacy redirect (Traefik)', () => {
  it('preserves path when redirecting to canonical host', () => {
    expect(legacyRedirectReplacement('platform.intra.ca')).toBe('https://platform.intra.ca/$1');
    expect(legacyRedirectRegex()).toBe('^https?://[^/]+/?(.*)$');
  });
});

describe('normalizePublicUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizePublicUrl('https://platform.intra.ca/')).toBe('https://platform.intra.ca');
  });
});
