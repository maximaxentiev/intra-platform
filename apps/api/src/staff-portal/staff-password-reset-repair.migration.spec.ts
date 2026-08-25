import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import journal from '../../drizzle/meta/_journal.json';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const REPAIR_SQL = readFileSync(
  join(__dirname, '../../drizzle/0016_staff_password_reset_repair.sql'),
  'utf8',
);

const PASSWORD_RESET_COLUMNS = [
  'password_reset_token_hash',
  'password_reset_token_expires_at',
  'password_reset_requested_at',
] as const;

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

async function staffAccountsColumnNames(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'staff_accounts'`,
  );
  return new Set(result.rows.map((row) => row.column_name));
}

const POSTGRES_READY = await probePostgres();

describe('0016 staff password reset repair migration metadata', () => {
  it('orders 0016 after 0014 by journal timestamp', () => {
    const entries = journal.entries.filter((entry) =>
      ['0013_vsc_annual_expiry_backfill', '0014_platform_audit_events', '0015_staff_password_reset', '0016_staff_password_reset_repair'].includes(
        entry.tag,
      ),
    );

    expect(entries.map((entry) => entry.tag)).toEqual([
      '0013_vsc_annual_expiry_backfill',
      '0014_platform_audit_events',
      '0015_staff_password_reset',
      '0016_staff_password_reset_repair',
    ]);

    const whenByTag = Object.fromEntries(entries.map((entry) => [entry.tag, entry.when]));
    expect(whenByTag['0014_platform_audit_events']).toBe(1787600000000);
    expect(whenByTag['0015_staff_password_reset']).toBe(1787593105455);
    expect(whenByTag['0016_staff_password_reset_repair']).toBeGreaterThan(
      whenByTag['0014_platform_audit_events']!,
    );
  });

  it('uses idempotent ADD COLUMN IF NOT EXISTS for all reset fields', () => {
    for (const column of PASSWORD_RESET_COLUMNS) {
      expect(REPAIR_SQL).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(REPAIR_SQL).not.toMatch(/DROP COLUMN|ALTER COLUMN|UPDATE /i);
  });
});

describe.runIf(POSTGRES_READY)('0016 staff password reset repair migration postgres', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('succeeds when columns already exist and leaves existing data untouched', async () => {
    const beforeColumns = await staffAccountsColumnNames(pool);
    for (const column of PASSWORD_RESET_COLUMNS) {
      expect(beforeColumns.has(column)).toBe(true);
    }

    const sampleBefore = await pool.query<{ count: string }>(
      'select count(*)::text as count from staff_accounts',
    );
    const countBefore = sampleBefore.rows[0]?.count;

    await pool.query(REPAIR_SQL.replace(/--> statement-breakpoint/g, '\n'));

    const afterColumns = await staffAccountsColumnNames(pool);
    for (const column of PASSWORD_RESET_COLUMNS) {
      expect(afterColumns.has(column)).toBe(true);
    }

    const sampleAfter = await pool.query<{ count: string }>(
      'select count(*)::text as count from staff_accounts',
    );
    expect(sampleAfter.rows[0]?.count).toBe(countBefore);
  });

  it('remains a no-op on repeated application', async () => {
    await expect(
      pool.query(REPAIR_SQL.replace(/--> statement-breakpoint/g, '\n')),
    ).resolves.toBeDefined();
    await expect(
      pool.query(REPAIR_SQL.replace(/--> statement-breakpoint/g, '\n')),
    ).resolves.toBeDefined();
  });
});

describe.runIf(!POSTGRES_READY)('0016 staff password reset repair migration postgres', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});
