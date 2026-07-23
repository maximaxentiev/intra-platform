import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Locate the monorepo root's `.env` file for local development.
 *
 * When the API is started via the npm workspace scripts (`npm run dev:api`
 * from the repo root), npm sets the child process's working directory to
 * `apps/api`, so `@nestjs/config`'s default `.env` lookup (relative to
 * `process.cwd()`) and any ad-hoc `process.env.DATABASE_URL` reads in
 * standalone scripts (e.g. the migration runner) would miss the root
 * `.env` entirely.
 *
 * This walks up from this file's own location — which has a fixed,
 * predictable depth under the repo root regardless of caller — until it
 * finds the repo root (marked by `docker-compose.yml`), and returns the
 * path to that root's `.env` file if one exists.
 *
 * In Docker (staging/production), Compose injects real environment
 * variables directly, no `.env` file is copied into the image, and this
 * simply finds nothing — a safe no-op.
 */
export function findRepoRootEnvFile(): string | undefined {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'docker-compose.yml'))) {
      const envPath = join(dir, '.env');
      return existsSync(envPath) ? envPath : undefined;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}
