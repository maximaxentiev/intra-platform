/** Refuse imports that target localhost, Supabase, or non-staging Postgres hosts. */
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1']);

const BLOCKED_HOST_PATTERNS = [/supabase\.co/i, /pooler\.supabase\.com/i];

/** Docker Compose service name for staging Postgres (intra-ops-test stack). */
export const STAGING_POSTGRES_HOST = 'postgres';

/** Hostnames allowed when running destructive staging maintenance inside the droplet stack. */
export const STAGING_APP_HOSTS = new Set(['platform.intra.ca', 'ops-test.intra.ca']);

export function parseDatabaseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres:/, 'postgresql:')).hostname.toLowerCase();
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is not a valid Postgres connection URL.');
  }
}

export function assertStagingDatabaseUrl(databaseUrl: string): void {
  const host = parseDatabaseHost(databaseUrl);

  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run: DATABASE_URL host "${host}" is local. ` +
        'This script only writes to the shared staging Postgres (ops-test.intra.ca).',
    );
  }

  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error(
        `Refusing to run: DATABASE_URL host "${host}" looks like Supabase/Lovable Cloud.`,
      );
    }
  }

  if (host !== STAGING_POSTGRES_HOST) {
    throw new Error(
      `Refusing to run: DATABASE_URL host must be "${STAGING_POSTGRES_HOST}" ` +
        `(intra-ops-test API container → staging Postgres). Got "${host}".`,
    );
  }
}

export function assertStagingAppHost(): void {
  const appHost = process.env.APP_HOST?.trim().toLowerCase();
  if (!appHost || !STAGING_APP_HOSTS.has(appHost)) {
    throw new Error(
      'Refusing to run: APP_HOST must be one of ' +
        `${[...STAGING_APP_HOSTS].join(', ')} (staging droplet). Got "${appHost ?? ''}".`,
    );
  }
}

/** Confirms this process is running in the intra-ops-test API container against staging Postgres. */
export function assertStagingMaintenanceEnvironment(databaseUrl: string): void {
  assertStagingDatabaseUrl(databaseUrl);
  assertStagingAppHost();
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Refusing to run: NODE_ENV must be "production" inside the staging API container.',
    );
  }
}

/** Explicit operator acknowledgement required before any destructive staging reset. */
export function assertStagingCleanupConfirmation(execute: boolean): void {
  if (!execute) return;
  const token = process.env.STAGING_STAFF_CLEANUP_CONFIRM?.trim();
  if (token !== 'YES') {
    throw new Error(
      'Refusing to execute: set STAGING_STAFF_CLEANUP_CONFIRM=YES after taking a fresh backup.',
    );
  }
}
