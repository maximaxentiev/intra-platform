import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';

/** Idempotent 0014 schema for integration tests (does not run full migrator). */
export async function ensurePlatformAuditTable(pool: Pool): Promise<void> {
  try {
    await pool.query('SELECT 1 FROM platform_audit_events LIMIT 0');
    return;
  } catch {
    // apply migration
  }

  const sqlPath = path.join(__dirname, '../../drizzle/0014_platform_audit_events.sql');
  const raw = readFileSync(sqlPath, 'utf8');
  const statements = raw
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) continue;
      throw error;
    }
  }
}
