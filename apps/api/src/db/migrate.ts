/**
 * Standalone migration runner. Invoked via `npm run db:migrate` (tsx) and on
 * API container startup before the Nest app boots.
 */
import { config as loadDotenv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { findRepoRootEnvFile } from '../config/root-env';

// Local dev: this script is run standalone (not through Nest's ConfigModule),
// so load the monorepo root .env ourselves. No-op in Docker, where real env
// vars are already injected and no .env file exists in the image.
const rootEnvFile = findRepoRootEnvFile();
if (rootEnvFile) loadDotenv({ path: rootEnvFile });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run migrations.');

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  // eslint-disable-next-line no-console
  console.log('[migrate] applying migrations…');
  await migrate(db, { migrationsFolder: `${__dirname}/../../drizzle` });
  // eslint-disable-next-line no-console
  console.log('[migrate] done.');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
