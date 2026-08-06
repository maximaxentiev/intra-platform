import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const baseConfig = {
  DATABASE_URL: 'postgres://u:p@localhost/db',
  REDIS_URL: 'redis://127.0.0.1:6379',
  SESSION_SECRET: 'long-enough-secret-here',
};

describe('validateEnv CORS and platform URL', () => {
  it('merges canonical origin into CORS in production', () => {
    const env = validateEnv({
      ...baseConfig,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://platform.intra.ca',
      LEGACY_APP_HOST: 'ops-test.intra.ca',
      CORS_ORIGINS: 'https://platform.intra.ca',
    });
    expect(env.CORS_ORIGINS).toContain('https://platform.intra.ca');
    expect(env.CORS_ORIGINS).toContain('https://ops-test.intra.ca');
    expect(env.APP_PUBLIC_URL).toBe('https://platform.intra.ca');
  });

  it('keeps local CORS in development without requiring APP_HOST', () => {
    const env = validateEnv({
      ...baseConfig,
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:8080',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:8080']);
  });
});
