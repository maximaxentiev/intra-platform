/** Refuse imports that target staging, production, or any non-local Postgres host. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function assertLocalDatabaseUrl(databaseUrl: string): void {
  let host: string;
  try {
    host = new URL(databaseUrl.replace(/^postgres:/, 'postgresql:')).hostname.toLowerCase();
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is not a valid Postgres connection URL.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run: DATABASE_URL host "${host}" is not local. ` +
        'This script only writes to localhost or 127.0.0.1.',
    );
  }
}
