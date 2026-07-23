/**
 * Standalone migration runner. Invoked via `npm run db:migrate` (tsx) and on
 * API container startup before the Nest app boots.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

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
