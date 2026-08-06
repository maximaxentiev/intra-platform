import { mergeProductionCorsOrigins, resolvePublicPlatformUrl } from './platform-url';

/**
 * Runtime env validation. Fails fast on boot if required vars are missing.
 */
export interface AppEnv {
  NODE_ENV: string;
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  CORS_ORIGINS: string[];
  APP_PUBLIC_URL?: string;
  APP_HOST?: string;
  LEGACY_APP_HOST?: string;
  SESSION_SECRET: string;
  SESSION_COOKIE_NAME: string;
  SESSION_COOKIE_SECURE: boolean;
  SESSION_TTL_SECONDS: number;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  BOOTSTRAP_ADMIN_NAME?: string;
  OBJECT_STORAGE_ENDPOINT?: string;
  OBJECT_STORAGE_BUCKET?: string;
  OBJECT_STORAGE_ACCESS_KEY?: string;
  OBJECT_STORAGE_SECRET_KEY?: string;
  OBJECT_STORAGE_REGION?: string;
  NETWORK_APPLICATION_API_KEY?: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const sessionSecret = required('SESSION_SECRET', config.SESSION_SECRET as string);
  if (sessionSecret.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters.');
  }

  const nodeEnv = (config.NODE_ENV as string) ?? 'development';
  const appHost = trimOptional(config.APP_HOST);
  const legacyAppHost = trimOptional(config.LEGACY_APP_HOST);
  const platformEnv = {
    APP_PUBLIC_URL: trimOptional(config.APP_PUBLIC_URL),
    APP_HOST: appHost,
    LEGACY_APP_HOST: legacyAppHost,
    NODE_ENV: nodeEnv,
  };
  const appPublicUrl =
    nodeEnv === 'production' ? resolvePublicPlatformUrl(platformEnv) : trimOptional(config.APP_PUBLIC_URL);

  const corsConfigured = String(config.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const corsOrigins =
    nodeEnv === 'production'
      ? mergeProductionCorsOrigins(corsConfigured, platformEnv)
      : corsConfigured;

  return {
    NODE_ENV: nodeEnv,
    API_PORT: Number(config.API_PORT ?? 8000),
    DATABASE_URL: required('DATABASE_URL', config.DATABASE_URL as string),
    REDIS_URL: required('REDIS_URL', config.REDIS_URL as string),
    CORS_ORIGINS: corsOrigins,
    APP_PUBLIC_URL: appPublicUrl,
    APP_HOST: appHost,
    LEGACY_APP_HOST: legacyAppHost,
    SESSION_SECRET: sessionSecret,
    SESSION_COOKIE_NAME: (config.SESSION_COOKIE_NAME as string) ?? 'intra_session',
    SESSION_COOKIE_SECURE: String(config.SESSION_COOKIE_SECURE ?? 'false') === 'true',
    SESSION_TTL_SECONDS: Number(config.SESSION_TTL_SECONDS ?? 43200),
    BOOTSTRAP_ADMIN_EMAIL: config.BOOTSTRAP_ADMIN_EMAIL as string | undefined,
    BOOTSTRAP_ADMIN_PASSWORD: config.BOOTSTRAP_ADMIN_PASSWORD as string | undefined,
    BOOTSTRAP_ADMIN_NAME: config.BOOTSTRAP_ADMIN_NAME as string | undefined,
    OBJECT_STORAGE_ENDPOINT: trimOptional(config.OBJECT_STORAGE_ENDPOINT),
    OBJECT_STORAGE_BUCKET: trimOptional(config.OBJECT_STORAGE_BUCKET),
    OBJECT_STORAGE_ACCESS_KEY: trimOptional(config.OBJECT_STORAGE_ACCESS_KEY),
    OBJECT_STORAGE_SECRET_KEY: trimOptional(config.OBJECT_STORAGE_SECRET_KEY),
    OBJECT_STORAGE_REGION: trimOptional(config.OBJECT_STORAGE_REGION),
    NETWORK_APPLICATION_API_KEY: trimOptional(config.NETWORK_APPLICATION_API_KEY),
  };
}

function trimOptional(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}
