import { sql } from 'drizzle-orm';
import type { INestApplicationContext } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { bootstrapWorker } from './worker.module';

const SCHEMA_POLL_MS = 3000;
const SCHEMA_POLL_MAX = 40;

async function waitForCommunicationsSchema(app: INestApplicationContext): Promise<void> {
  const db = app.get<Database>(DRIZZLE);
  for (let attempt = 0; attempt < SCHEMA_POLL_MAX; attempt += 1) {
    try {
      await db.execute(sql`SELECT 1 FROM scheduled_communications LIMIT 0`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, SCHEMA_POLL_MS));
    }
  }
  throw new Error(
    'scheduled_communications table not ready — ensure API migrations (0012+) have run.',
  );
}

async function main(): Promise<void> {
  const { processor, reconciler, app } = await bootstrapWorker();

  await waitForCommunicationsSchema(app);

  await reconciler.runReconciliation();

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[worker] received ${signal}, shutting down…`);
    await processor.stopWorker();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // eslint-disable-next-line no-console
  console.log('[worker] automated communications worker started');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal startup error:', error);
  process.exit(1);
});
